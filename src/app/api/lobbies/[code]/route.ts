import { NextResponse } from "next/server"

import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"
import {
  getPlayerPlanMap,
  getRelayGameSummaryForUser,
} from "@/lib/relay/server-relay-pricing"

function normalizeCode(code: string) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase()
}

type RouteContext = {
  params: Promise<{
    code: string
  }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { code: rawCode } = await params
  if (!rawCode) {
    return Response.json({ error: "Missing lobby code" }, { status: 400 })
  }
  const code = normalizeCode(rawCode)
  // console.log("LOBBY_CODE", code)

  const lobby = await prisma.lobby.findUnique({
    where: { code },
    include: {
      players: {
        where: { leftAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authUserId: true,
          name: true,
          isHost: true,
          createdAt: true,
          _count: { select: { photos: true } },
        },
      },
    },
  })
  // console.log("LOBBY_RESULT", lobby)

  if (!lobby) {
    // const lobbyCount = await prisma.lobby.count()
    // console.log("LOBBY_COUNT", lobbyCount)
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if (await expireLobbyIfNeeded(lobby)) {
    return NextResponse.json({ error: "expired" }, { status: 410 })
  }

  const url = new URL(request.url)
  const playerId = url.searchParams.get("playerId")?.trim() ?? ""
  const totalPhotos = await prisma.photo.count({
    where: { lobbyId: lobby.id },
  })
  const shouldRevealCard =
    lobby.status === "IN_GAME" &&
    (lobby.mode === "IN_PERSON" ||
      (Boolean(playerId) && playerId !== lobby.activePlayerId))
  const currentCard = shouldRevealCard
    ? await prisma.photo.findFirst({
        where: {
          lobbyId: lobby.id,
          deckOrder: lobby.currentCardIndex,
        },
        select: {
          id: true,
          title: true,
          publicUrl: true,
        },
      })
    : null
  const myPhotos = playerId
    ? await prisma.photo.findMany({
        where: { lobbyId: lobby.id, playerId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          publicUrl: true,
          createdAt: true,
        },
      })
    : []

  let planMap: Record<string, "FREE" | "CORE" | "PRO"> = {}
  try {
    planMap = await getPlayerPlanMap(
      lobby.players.map((player) => player.authUserId ?? "")
    )
  } catch {
    // Failsafe while relay tables are rolling out.
    planMap = {}
  }

  const currentPlayer = playerId
    ? lobby.players.find((player) => player.id === playerId) ?? null
    : null
  let relayGameSummary: Awaited<ReturnType<typeof getRelayGameSummaryForUser>> = {
    gameDurationMinutes: Math.max(
      0,
      Math.round(
        ((lobby.endedAt ?? new Date()).getTime() - lobby.createdAt.getTime()) / 60_000
      )
    ),
    playerDurationMinutes: Math.max(
      0,
      Math.round(
        ((lobby.endedAt ?? new Date()).getTime() -
          (currentPlayer?.createdAt ?? lobby.createdAt).getTime()) /
          60_000
      )
    ),
    relayMinutesUsed: 0,
    relayHoursUsedPersonally: 0,
    relayHoursSharedByPlayers: 0,
    relayHoursSharedByYou: 0,
    relayHoursUsedTotal: 0,
    remainingSubscriptionHours: 0,
    planType: "FREE" as const,
    hasSubscription: false,
  }
  try {
    relayGameSummary = await getRelayGameSummaryForUser({
      lobbyId: lobby.id,
      gameStartedAt: lobby.createdAt,
      gameEndedAt: lobby.endedAt,
      playerId: currentPlayer?.id ?? null,
      playerJoinedAt: currentPlayer?.createdAt ?? null,
      authUserId: currentPlayer?.authUserId ?? null,
    })
  } catch {
    // Failsafe for environments that have not run relay-pricing migration yet.
  }

  return NextResponse.json({
    lobby: {
      id: lobby.id,
      code: lobby.code,
      status: lobby.status,
      mode: lobby.mode,
      createdAt: lobby.createdAt,
      expiresAt: lobby.expiresAt,
      hostPlayerId: lobby.hostPlayerId,
      activePlayerId: lobby.activePlayerId,
      currentCardIndex: lobby.currentCardIndex,
      currentTurnIndex: lobby.currentTurnIndex,
      endedAt: lobby.endedAt,
    },
    players: lobby.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      createdAt: player.createdAt,
      photoCount: player._count.photos,
      planType: player.authUserId ? planMap[player.authUserId] ?? "FREE" : "FREE",
    })),
    photos: {
      totalPhotos,
      myPhotos,
      currentCard,
    },
    summary: relayGameSummary,
  })
}

import { NextResponse } from "next/server"

import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"

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

  return NextResponse.json({
    lobby: {
      id: lobby.id,
      code: lobby.code,
      status: lobby.status,
      mode: lobby.mode,
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
    })),
    photos: {
      totalPhotos,
      myPhotos,
      currentCard,
    },
  })
}

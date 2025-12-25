import { NextResponse } from "next/server"

import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"

function normalizeCode(code: string) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const lobbyCodeRaw = typeof body?.lobbyCode === "string" ? body.lobbyCode : ""
  const playerIdRaw = typeof body?.playerId === "string" ? body.playerId : ""

  const lobbyCode = normalizeCode(lobbyCodeRaw)
  const playerId = playerIdRaw.trim()

  if (!lobbyCode || !playerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const lobby = await prisma.lobby.findUnique({ where: { code: lobbyCode } })
  if (!lobby) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if (await expireLobbyIfNeeded(lobby)) {
    return NextResponse.json({ error: "expired" }, { status: 410 })
  }

  if (lobby.status !== "IN_GAME") {
    return NextResponse.json({ error: "not_in_game" }, { status: 409 })
  }

  if (lobby.activePlayerId !== playerId) {
    return NextResponse.json({ error: "not_active" }, { status: 403 })
  }

  const players = await prisma.player.findMany({
    where: { lobbyId: lobby.id, leftAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (players.length === 0) {
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: { status: "ENDED", endedAt: new Date(), activePlayerId: null },
    })
    return NextResponse.json({ ok: true })
  }

  const photoCount = await prisma.photo.count({ where: { lobbyId: lobby.id } })
  const nextCardIndex = lobby.currentCardIndex + 1

  if (nextCardIndex >= photoCount) {
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        currentCardIndex: nextCardIndex,
      },
    })
    return NextResponse.json({ ok: true })
  }

  const currentIndex = players.findIndex((player) => player.id === playerId)
  const nextPlayer =
    players[currentIndex === -1 ? 0 : (currentIndex + 1) % players.length]

  await prisma.lobby.update({
    where: { id: lobby.id },
    data: {
      activePlayerId: nextPlayer.id,
      currentCardIndex: nextCardIndex,
      currentTurnIndex: lobby.currentTurnIndex + 1,
    },
  })

  return NextResponse.json({ ok: true })
}
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

  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player || player.lobbyId !== lobby.id) {
    return NextResponse.json({ error: "not_in_lobby" }, { status: 403 })
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { leftAt: new Date() },
  })

  const remainingPlayers = await prisma.player.findMany({
    where: { lobbyId: lobby.id, leftAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (remainingPlayers.length === 0) {
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: { status: "ENDED", endedAt: new Date(), activePlayerId: null },
    })
    return NextResponse.json({ ok: true })
  }

  if (lobby.activePlayerId === playerId) {
    const nextPlayer = remainingPlayers[0]
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: {
        activePlayerId: nextPlayer.id,
        currentTurnIndex: lobby.currentTurnIndex + 1,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
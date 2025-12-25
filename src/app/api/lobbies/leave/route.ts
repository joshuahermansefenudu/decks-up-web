import { NextResponse } from "next/server"

import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { removePlayerPhotoStorage } from "@/lib/lobby-cleanup"
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

  if (lobby.status !== "LOBBY") {
    return NextResponse.json({ error: "not_open" }, { status: 409 })
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player || player.lobbyId !== lobby.id) {
    return NextResponse.json({ error: "not_in_lobby" }, { status: 403 })
  }

  try {
    await removePlayerPhotoStorage(lobby.id, playerId)
  } catch (error) {
    console.error("PLAYER_STORAGE_DELETE_ERROR", error)
    return NextResponse.json({ error: "storage_delete_failed" }, { status: 500 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.photo.deleteMany({
      where: { lobbyId: lobby.id, playerId },
    })

    await tx.player.delete({ where: { id: playerId } })

    if (player.isHost) {
      const nextHost = await tx.player.findFirst({
        where: { lobbyId: lobby.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })

      if (nextHost) {
        await tx.player.update({
          where: { id: nextHost.id },
          data: { isHost: true },
        })
        await tx.lobby.update({
          where: { id: lobby.id },
          data: { hostPlayerId: nextHost.id },
        })
      } else {
        await tx.lobby.update({
          where: { id: lobby.id },
          data: { hostPlayerId: null },
        })
      }
    }
  })

  return NextResponse.json({ ok: true })
}

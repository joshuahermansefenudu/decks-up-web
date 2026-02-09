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
  const requesterPlayerIdRaw =
    typeof body?.requesterPlayerId === "string" ? body.requesterPlayerId : ""
  const targetPlayerIdRaw =
    typeof body?.targetPlayerId === "string" ? body.targetPlayerId : ""

  const lobbyCode = normalizeCode(lobbyCodeRaw)
  const requesterPlayerId = requesterPlayerIdRaw.trim()
  const targetPlayerId = targetPlayerIdRaw.trim()

  if (!lobbyCode || !requesterPlayerId || !targetPlayerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  if (requesterPlayerId === targetPlayerId) {
    return NextResponse.json({ error: "cannot_remove_self" }, { status: 400 })
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

  const requester = await prisma.player.findUnique({
    where: { id: requesterPlayerId },
  })
  if (!requester || requester.lobbyId !== lobby.id || !requester.isHost) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const target = await prisma.player.findUnique({
    where: { id: targetPlayerId },
  })
  if (!target || target.lobbyId !== lobby.id) {
    return NextResponse.json({ error: "target_not_found" }, { status: 404 })
  }

  if (target.isHost) {
    return NextResponse.json({ error: "cannot_remove_host" }, { status: 409 })
  }

  try {
    await removePlayerPhotoStorage(lobby.id, targetPlayerId)
  } catch (error) {
    console.error("REMOVE_PLAYER_STORAGE_ERROR", error)
    return NextResponse.json({ error: "storage_delete_failed" }, { status: 500 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.photo.deleteMany({
      where: { lobbyId: lobby.id, playerId: targetPlayerId },
    })

    await tx.player.delete({
      where: { id: targetPlayerId },
    })
  })

  return NextResponse.json({ ok: true })
}

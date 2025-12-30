import { NextResponse } from "next/server"

import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"
import { supabaseAdmin } from "@/lib/supabase-admin"

function normalizeCode(code: string) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const photoId =
    typeof body?.photoId === "string" ? body.photoId.trim() : ""
  const lobbyCodeRaw =
    typeof body?.lobbyCode === "string" ? body.lobbyCode : ""
  const playerId =
    typeof body?.playerId === "string" ? body.playerId.trim() : ""

  const lobbyCode = normalizeCode(lobbyCodeRaw)

  if (!photoId || !lobbyCode || !playerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const lobby = await prisma.lobby.findUnique({ where: { code: lobbyCode } })
  if (!lobby) {
    return NextResponse.json({ error: "Lobby not found" }, { status: 404 })
  }

  if (await expireLobbyIfNeeded(lobby)) {
    return NextResponse.json({ error: "Lobby expired" }, { status: 410 })
  }

  if (lobby.status !== "LOBBY") {
    return NextResponse.json({ error: "Lobby not open" }, { status: 409 })
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player || player.lobbyId !== lobby.id) {
    return NextResponse.json({ error: "Player not in lobby" }, { status: 403 })
  }

  const photo = await prisma.photo.findUnique({ where: { id: photoId } })
  if (!photo || photo.lobbyId !== lobby.id || photo.playerId !== playerId) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 })
  }

  if (photo.storagePath) {
    const { error } = await supabaseAdmin.storage
      .from("deck-photos")
      .remove([photo.storagePath])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  await prisma.photo.delete({ where: { id: photo.id } })

  return NextResponse.json({ ok: true })
}

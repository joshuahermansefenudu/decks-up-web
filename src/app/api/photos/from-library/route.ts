import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"
import { supabaseAdmin } from "@/lib/supabase-admin"

const MAX_PHOTOS = 5
const STORAGE_BUCKET = "deck-photos"

function normalizeCode(code: string) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase()
}

function getPathExtension(path: string) {
  const fileName = path.split("/").pop() ?? ""
  const parts = fileName.split(".")
  if (parts.length > 1) {
    return parts.pop()?.toLowerCase() ?? "bin"
  }
  return "bin"
}

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const libraryPhotoId =
    typeof body?.libraryPhotoId === "string" ? body.libraryPhotoId.trim() : ""
  const lobbyCodeRaw = typeof body?.lobbyCode === "string" ? body.lobbyCode : ""
  const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : ""
  const lobbyCode = normalizeCode(lobbyCodeRaw)

  if (!libraryPhotoId || !lobbyCode || !playerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const libraryPhoto = await prisma.accountPhoto.findFirst({
    where: { id: libraryPhotoId, userId: user.id },
    select: { id: true, storagePath: true },
  })
  if (!libraryPhoto) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 })
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

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, lobbyId: true, authUserId: true },
  })
  if (!player || player.lobbyId !== lobby.id) {
    return NextResponse.json({ error: "Player not in lobby" }, { status: 403 })
  }

  if (!player.authUserId || player.authUserId !== user.id) {
    return NextResponse.json(
      { error: "Saved photos can only be used by your signed-in lobby player." },
      { status: 403 }
    )
  }

  const photoCount = await prisma.photo.count({
    where: { lobbyId: lobby.id, playerId },
  })
  if (photoCount >= MAX_PHOTOS) {
    return NextResponse.json({ error: "Photo limit reached" }, { status: 409 })
  }

  const photoId = randomUUID()
  const extension = getPathExtension(libraryPhoto.storagePath)
  const storagePath = `lobbies/${lobby.code}/${playerId}/${photoId}.${extension}`

  const { error: copyError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .copy(libraryPhoto.storagePath, storagePath)

  if (copyError) {
    return NextResponse.json({ error: copyError.message }, { status: 500 })
  }

  const { data: publicData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)
  const publicUrl = publicData?.publicUrl

  if (!publicUrl) {
    return NextResponse.json({ error: "Unable to read public URL" }, { status: 500 })
  }

  const photo = await prisma.photo.create({
    data: {
      id: photoId,
      lobbyId: lobby.id,
      playerId,
      title: "",
      storagePath,
      publicUrl,
    },
    select: {
      id: true,
      title: true,
      publicUrl: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ photo })
}

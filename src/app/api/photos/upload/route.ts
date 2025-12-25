import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"
import { supabaseAdmin } from "@/lib/supabase-admin"

const MAX_PHOTOS = 2
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

function normalizeCode(code: string) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase()
}

function getFileExtension(file: File) {
  const name = file.name ?? ""
  const parts = name.split(".")
  if (parts.length > 1) {
    return parts.pop()?.toLowerCase()
  }
  if (file.type && file.type.includes("/")) {
    return file.type.split("/").pop()?.toLowerCase()
  }
  return "bin"
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file")
  const titleRaw = formData.get("title")
  const lobbyCodeRaw = formData.get("lobbyCode")
  const playerIdRaw = formData.get("playerId")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (typeof lobbyCodeRaw !== "string") {
    return NextResponse.json({ error: "Missing lobby code" }, { status: 400 })
  }

  if (typeof playerIdRaw !== "string") {
    return NextResponse.json({ error: "Missing player" }, { status: 400 })
  }

  const lobbyCode = normalizeCode(lobbyCodeRaw)
  const playerId = playerIdRaw.trim()
  const title = typeof titleRaw === "string" ? titleRaw.trim() : ""

  if (!lobbyCode) {
    return NextResponse.json({ error: "Missing lobby code" }, { status: 400 })
  }

  if (!playerId) {
    return NextResponse.json({ error: "Missing player" }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 })
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

  const photoCount = await prisma.photo.count({
    where: { lobbyId: lobby.id, playerId },
  })
  if (photoCount >= MAX_PHOTOS) {
    return NextResponse.json({ error: "Photo limit reached" }, { status: 409 })
  }

  const photoId = randomUUID()
  const extension = getFileExtension(file)
  const storagePath = `lobbies/${lobby.code}/${playerId}/${photoId}.${extension}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabaseAdmin.storage
    .from("deck-photos")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicData } = supabaseAdmin.storage
    .from("deck-photos")
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
      title,
      storagePath,
      publicUrl,
    },
    select: {
      id: true,
      title: true,
      publicUrl: true,
      storagePath: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ photo })
}

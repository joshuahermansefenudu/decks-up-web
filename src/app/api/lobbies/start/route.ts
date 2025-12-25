import { NextResponse } from "next/server"
import { randomInt } from "crypto"

import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"

function normalizeCode(code: string) {
  return (code ?? "").replace(/\s+/g, "").toUpperCase()
}

function createSeed(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function shuffleDeterministic<T>(items: T[], seed: number) {
  const result = [...items]
  let state = seed || 1
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296
    const rand = state / 4294967296
    const nextIndex = Math.floor(rand * (index + 1))
    const temp = result[index]
    result[index] = result[nextIndex]
    result[nextIndex] = temp
  }
  return result
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

  const lobby = await prisma.lobby.findUnique({
    where: { code: lobbyCode },
  })

  if (!lobby) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if (await expireLobbyIfNeeded(lobby)) {
    return NextResponse.json({ error: "expired" }, { status: 410 })
  }

  if (lobby.status !== "LOBBY") {
    return NextResponse.json({ error: "not_open" }, { status: 409 })
  }

  const hostCheck = await prisma.player.findUnique({ where: { id: playerId } })
  if (!hostCheck || hostCheck.lobbyId !== lobby.id || !hostCheck.isHost) {
    return NextResponse.json({ error: "not_host" }, { status: 403 })
  }

  const photos = await prisma.photo.findMany({
    where: { lobbyId: lobby.id },
    select: { id: true },
  })

  if (photos.length === 0) {
    return NextResponse.json({ error: "no_photos" }, { status: 409 })
  }

  const players = await prisma.player.findMany({
    where: { lobbyId: lobby.id, leftAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  if (players.length === 0) {
    return NextResponse.json({ error: "no_players" }, { status: 409 })
  }

  const shuffled = shuffleDeterministic(photos, createSeed(lobby.id))
  const startingPlayer = players[randomInt(players.length)]

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      shuffled.map((photo, index) =>
        tx.photo.update({
          where: { id: photo.id },
          data: { deckOrder: index },
        })
      )
    )

    await tx.lobby.update({
      where: { id: lobby.id },
      data: {
        status: "IN_GAME",
        activePlayerId: startingPlayer.id,
        currentCardIndex: 0,
        currentTurnIndex: 0,
        endedAt: null,
      },
    })
  })

  return NextResponse.json({ ok: true })
}
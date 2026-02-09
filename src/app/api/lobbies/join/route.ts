import { NextResponse } from "next/server"

import { getOptionalAuthUser } from "@/lib/auth-user"
import { expireLobbyIfNeeded } from "@/lib/lobby-expiration"
import { prisma } from "@/lib/prisma"

const MAX_PLAYERS = 8

function normalizeCode(code: string) {
  return code.replace(/\s+/g, "").toUpperCase()
}

export async function POST(request: Request) {
  const { user } = await getOptionalAuthUser(request)
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const codeRaw = typeof body?.code === "string" ? body.code.trim() : ""
  const code = normalizeCode(codeRaw)

  if (!name || !code) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  const lobby = await prisma.lobby.findUnique({
    where: { code },
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

  const playerCount = await prisma.player.count({
    where: { lobbyId: lobby.id, leftAt: null },
  })

  if (playerCount >= MAX_PLAYERS) {
    return NextResponse.json({ error: "lobby_full" }, { status: 409 })
  }

  const player = await prisma.player.create({
    data: {
      lobbyId: lobby.id,
      authUserId: user?.id ?? null,
      name,
      isHost: false,
    },
  })

  return NextResponse.json({ code: lobby.code, playerId: player.id })
}

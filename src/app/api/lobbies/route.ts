import { NextResponse } from "next/server"

import { generateUniqueLobbyCode } from "@/lib/lobby-code"
import { prisma } from "@/lib/prisma"

const LOBBY_TTL_HOURS = 12

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim() : ""

    if (!name) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 })
    }

    const code = await generateUniqueLobbyCode(prisma)
    const expiresAt = new Date(Date.now() + LOBBY_TTL_HOURS * 60 * 60 * 1000)

    const result = await prisma.$transaction(async (tx) => {
      const lobby = await tx.lobby.create({
        data: {
          code,
          status: "LOBBY",
          expiresAt,
        },
      })

      const player = await tx.player.create({
        data: {
          lobbyId: lobby.id,
          name,
          isHost: true,
        },
      })

      await tx.lobby.update({
        where: { id: lobby.id },
        data: { hostPlayerId: player.id },
      })

      return { lobby, player }
    })

    return NextResponse.json({
      code: result.lobby.code,
      playerId: result.player.id,
    })
  } catch (err) {
    console.error("CREATE_LOBBY_ERROR", err)
    return Response.json(
      { error: String((err as Error | undefined)?.message ?? err) },
      { status: 500 }
    )
  }
}

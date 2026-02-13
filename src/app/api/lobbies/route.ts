import { NextResponse } from "next/server"

import { getOptionalAuthUser } from "@/lib/auth-user"
import { generateUniqueLobbyCode } from "@/lib/lobby-code"
import { prisma } from "@/lib/prisma"

const LOBBY_TTL_HOURS = 12

export async function POST(request: Request) {
  try {
    const { user } = await getOptionalAuthUser(request)
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const modeRaw = typeof body?.mode === "string" ? body.mode : ""

    if (!name) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 })
    }

    const mode = modeRaw === "virtual" ? "VIRTUAL" : "IN_PERSON"

    const code = await generateUniqueLobbyCode(prisma)
    const expiresAt = new Date(Date.now() + LOBBY_TTL_HOURS * 60 * 60 * 1000)

    const result = await prisma.$transaction(async (tx) => {
      const lobby = await tx.lobby.create({
        data: {
          code,
          status: "LOBBY",
          mode,
          expiresAt,
        },
      })

      const player = await tx.player.create({
        data: {
          lobbyId: lobby.id,
          authUserId: user?.id ?? null,
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

    const maybeError = err as {
      message?: unknown
      code?: unknown
      name?: unknown
      meta?: unknown
    }

    const message =
      typeof maybeError.message === "string" && maybeError.message.trim()
        ? maybeError.message
        : "Request failed."

    return Response.json(
      {
        error: message,
        code: String(maybeError.code ?? ""),
        name: String(maybeError.name ?? ""),
        meta: maybeError.meta ?? null,
      },
      { status: 500 }
    )
  }
}

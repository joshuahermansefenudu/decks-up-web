import { NextResponse } from "next/server"

import { deleteLobbyData } from "@/lib/lobby-cleanup"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const lobbies = await prisma.lobby.findMany({
    where: {
      OR: [
        {
          endedAt: {
            lt: new Date(),
          },
        },
        {
          endedAt: null,
          expiresAt: {
            lt: new Date(),
          },
        },
      ],
    },
    select: { id: true },
  })

  let deletedLobbies = 0
  for (const lobby of lobbies) {
    try {
      await deleteLobbyData(lobby.id)
      deletedLobbies += 1
    } catch (error) {
      console.error("CLEANUP_ERROR", error)
    }
  }

  return NextResponse.json({ deletedLobbies })
}

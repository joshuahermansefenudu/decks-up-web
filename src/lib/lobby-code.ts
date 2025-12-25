import type { Prisma, PrismaClient } from "@prisma/client"
import { randomInt } from "crypto"

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 6

export function createLobbyCode(): string {
  let code = ""
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)]
  }
  return code
}

type PrismaClientLike = PrismaClient | Prisma.TransactionClient

export async function generateUniqueLobbyCode(
  prisma: PrismaClientLike,
  attempts = 10
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = createLobbyCode()
    const existing = await prisma.lobby.findUnique({ where: { code } })
    if (!existing) {
      return code
    }
  }

  throw new Error("Failed to generate a unique lobby code")
}

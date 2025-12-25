import { prisma } from "@/lib/prisma"
import { supabaseAdmin } from "@/lib/supabase-admin"

const STORAGE_BUCKET = "deck-photos"
const CHUNK_SIZE = 100

function chunkPaths(paths: string[]) {
  const chunks: string[][] = []
  for (let index = 0; index < paths.length; index += CHUNK_SIZE) {
    chunks.push(paths.slice(index, index + CHUNK_SIZE))
  }
  return chunks
}

async function removeStoragePaths(paths: string[]) {
  for (const chunk of chunkPaths(paths)) {
    if (chunk.length === 0) {
      continue
    }
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove(chunk)

    if (error) {
      throw new Error(`Storage cleanup failed: ${error.message}`)
    }
  }
}

export async function purgeLobbyGameplayData(lobbyId: string) {
  const photos = await prisma.photo.findMany({
    where: { lobbyId },
    select: { storagePath: true },
  })

  const paths = photos
    .map((photo) => photo.storagePath)
    .filter((path) => Boolean(path))

  await removeStoragePaths(paths)

  await prisma.$transaction(async (tx) => {
    await tx.photo.deleteMany({ where: { lobbyId } })
    await tx.player.deleteMany({ where: { lobbyId } })
    await tx.lobby.update({
      where: { id: lobbyId },
      data: {
        hostPlayerId: null,
        activePlayerId: null,
        currentCardIndex: 0,
        currentTurnIndex: 0,
      },
    })
  })
}

export async function deleteLobbyData(lobbyId: string) {
  await purgeLobbyGameplayData(lobbyId)
  await prisma.lobby.delete({ where: { id: lobbyId } })
}

export async function removePlayerPhotoStorage(
  lobbyId: string,
  playerId: string
) {
  const photos = await prisma.photo.findMany({
    where: { lobbyId, playerId },
    select: { storagePath: true },
  })

  const paths = photos
    .map((photo) => photo.storagePath)
    .filter((path) => Boolean(path))

  await removeStoragePaths(paths)
}

import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
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
      throw new Error(error.message)
    }
  }
}

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const photos = await prisma.accountPhoto.findMany({
    where: { userId: user.id },
    select: { storagePath: true },
  })

  const storagePaths = photos
    .map((photo) => photo.storagePath)
    .filter((path) => Boolean(path))

  try {
    await removeStoragePaths(storagePaths)
  } catch (storageError) {
    console.error("ACCOUNT_STORAGE_DELETE_ERROR", storageError)
    return NextResponse.json(
      { error: "Failed to delete account photos from storage." },
      { status: 500 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.accountPhoto.deleteMany({
      where: { userId: user.id },
    })
    await tx.player.updateMany({
      where: { authUserId: user.id },
      data: { authUserId: null },
    })
  })

  const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
    user.id
  )

  if (deleteAuthError) {
    console.error("ACCOUNT_AUTH_DELETE_ERROR", deleteAuthError)
    return NextResponse.json(
      { error: "Failed to delete authentication user." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

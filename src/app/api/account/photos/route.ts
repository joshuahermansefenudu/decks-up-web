import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { prisma } from "@/lib/prisma"
import { supabaseAdmin } from "@/lib/supabase-admin"

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const STORAGE_BUCKET = "deck-photos"

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

export async function GET(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const photos = await prisma.accountPhoto.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      publicUrl: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ photos })
}

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 })
  }

  const photoId = randomUUID()
  const extension = getFileExtension(file)
  const storagePath = `accounts/${user.id}/${photoId}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: publicData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  const publicUrl = publicData?.publicUrl
  if (!publicUrl) {
    return NextResponse.json({ error: "Unable to read public URL" }, { status: 500 })
  }

  const photo = await prisma.accountPhoto.create({
    data: {
      id: photoId,
      userId: user.id,
      storagePath,
      publicUrl,
    },
    select: {
      id: true,
      publicUrl: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ photo })
}

export async function DELETE(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const photoId = typeof body?.photoId === "string" ? body.photoId.trim() : ""
  if (!photoId) {
    return NextResponse.json({ error: "Missing photo id." }, { status: 400 })
  }

  const existing = await prisma.accountPhoto.findFirst({
    where: { id: photoId, userId: user.id },
    select: { id: true, storagePath: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 })
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([existing.storagePath])

  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 500 })
  }

  await prisma.accountPhoto.delete({ where: { id: existing.id } })

  return NextResponse.json({ ok: true })
}

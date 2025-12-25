import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("HEALTH_ERROR", err)
    return Response.json(
      { ok: false, error: String((err as Error | undefined)?.message ?? err) },
      { status: 500 }
    )
  }
}

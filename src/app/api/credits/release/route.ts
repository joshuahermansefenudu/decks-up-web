import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { releaseCredits } from "@/lib/sfu/server-credit-store"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    hostId?: string
    amountCredits?: number
  }
  const hostId = body.hostId?.trim() || user.id
  const amountCredits = Number.isFinite(body.amountCredits)
    ? Number(body.amountCredits)
    : 0

  const account = await releaseCredits(hostId, amountCredits)
  return NextResponse.json({
    hostId: account.hostId,
    balanceCredits: account.balanceCredits,
    reservedCredits: account.reservedCredits,
  })
}

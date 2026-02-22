import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { getCreditBalance } from "@/lib/sfu/server-credit-store"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const url = new URL(request.url)
  const hostId = url.searchParams.get("hostId")?.trim() || user.id
  const account = await getCreditBalance(hostId)

  return NextResponse.json({
    hostId: account.hostId,
    balanceCredits: account.balanceCredits,
    reservedCredits: account.reservedCredits,
    subscription: account.subscription,
  })
}

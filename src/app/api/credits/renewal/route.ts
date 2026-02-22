import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { renewSubscriptionForHost } from "@/lib/sfu/server-credit-store"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    hostId?: string
  }
  const hostId = body.hostId?.trim() || user.id
  const account = await renewSubscriptionForHost(hostId)

  return NextResponse.json({
    hostId: account.hostId,
    subscription: account.subscription,
    notifications: account.notifications,
  })
}

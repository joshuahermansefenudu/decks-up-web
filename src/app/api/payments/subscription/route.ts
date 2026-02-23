import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { getSubscriptionSummaryForUser } from "@/lib/payments/server"
import { getRelayProfile } from "@/lib/relay/server-relay-pricing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const [summary, profile] = await Promise.all([
    getSubscriptionSummaryForUser(user.id),
    getRelayProfile(user.id),
  ])

  return NextResponse.json({
    ...summary,
    relayProfile: profile,
  })
}

import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import {
  applyRelayPurchaseForUser,
  getRelayProfile,
} from "@/lib/relay/server-relay-pricing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const profile = await getRelayProfile(user.id)
  return NextResponse.json({ profile })
}

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    planType?: "FREE" | "CORE" | "PRO"
    creditPack?: "STARTER" | "STANDARD" | "PARTY"
  }

  try {
    const profile = await applyRelayPurchaseForUser({
      userId: user.id,
      planType: body.planType,
      creditPack: body.creditPack,
    })
    return NextResponse.json({ profile })
  } catch (routeError) {
    return NextResponse.json(
      { error: String((routeError as Error | undefined)?.message ?? routeError) },
      { status: 400 }
    )
  }
}


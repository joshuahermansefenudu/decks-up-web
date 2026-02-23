import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { getPurchaseTimelineForUser } from "@/lib/payments/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const timeline = await getPurchaseTimelineForUser(user.id)
  return NextResponse.json(timeline)
}

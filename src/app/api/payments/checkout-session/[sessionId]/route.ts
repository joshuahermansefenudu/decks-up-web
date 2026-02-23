import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { syncCheckoutSessionStatus } from "@/lib/payments/server"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const { sessionId } = await params
  if (!sessionId) {
    return NextResponse.json({ error: "Missing checkout session id." }, { status: 400 })
  }

  const status = await syncCheckoutSessionStatus({
    userId: user.id,
    sessionId,
  })

  return NextResponse.json(status)
}

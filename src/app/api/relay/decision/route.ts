import { NextResponse } from "next/server"

import { decideRelayRequest } from "@/lib/relay/server-relay-pricing"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    requestId?: string
    hostPlayerId?: string
    approved?: boolean
    maxMinutesGranted?: number
  }

  const requestId = body.requestId?.trim() ?? ""
  const hostPlayerId = body.hostPlayerId?.trim() ?? ""
  const approved = body.approved === true

  if (!requestId || !hostPlayerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  try {
    const result = await decideRelayRequest({
      requestId,
      hostPlayerId,
      approved,
      maxMinutesGranted: body.maxMinutesGranted,
    })
    return NextResponse.json(result)
  } catch (routeError) {
    return NextResponse.json(
      { error: String((routeError as Error | undefined)?.message ?? routeError) },
      { status: 400 }
    )
  }
}


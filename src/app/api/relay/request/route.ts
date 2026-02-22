import { NextResponse } from "next/server"

import { requestRelayAccess } from "@/lib/relay/server-relay-pricing"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    lobbyCode?: string
    requesterPlayerId?: string
  }

  const lobbyCode = body.lobbyCode?.trim() ?? ""
  const requesterPlayerId = body.requesterPlayerId?.trim() ?? ""

  if (!lobbyCode || !requesterPlayerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  try {
    const result = await requestRelayAccess({ lobbyCode, requesterPlayerId })
    return NextResponse.json(result)
  } catch (routeError) {
    return NextResponse.json(
      { error: String((routeError as Error | undefined)?.message ?? routeError) },
      { status: 400 }
    )
  }
}


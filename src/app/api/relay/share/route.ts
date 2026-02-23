import { NextResponse } from "next/server"

import { shareRelayHours } from "@/lib/relay/server-relay-pricing"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    lobbyCode?: string
    sharerPlayerId?: string
    requesterPlayerIds?: string[]
    maxMinutesGranted?: number
  }

  const lobbyCode = body.lobbyCode?.trim() ?? ""
  const sharerPlayerId = body.sharerPlayerId?.trim() ?? ""
  const requesterPlayerIds = Array.isArray(body.requesterPlayerIds)
    ? body.requesterPlayerIds
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    : []

  if (!lobbyCode || !sharerPlayerId || requesterPlayerIds.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  try {
    const result = await shareRelayHours({
      lobbyCode,
      sharerPlayerId,
      requesterPlayerIds,
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

import { NextResponse } from "next/server"

import { deductRelayTick } from "@/lib/relay/server-relay-pricing"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    lobbyCode?: string
    playerId?: string
    activeVideoParticipants?: number
  }

  const lobbyCode = body.lobbyCode?.trim() ?? ""
  const playerId = body.playerId?.trim() ?? ""
  const participants =
    Number.isFinite(body.activeVideoParticipants) && Number(body.activeVideoParticipants) > 0
      ? Number(body.activeVideoParticipants)
      : 1

  if (!lobbyCode || !playerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  try {
    const result = await deductRelayTick({
      lobbyCode,
      playerId,
      activeVideoParticipants: participants,
    })
    return NextResponse.json(result)
  } catch (routeError) {
    return NextResponse.json(
      { error: String((routeError as Error | undefined)?.message ?? routeError) },
      { status: 400 }
    )
  }
}


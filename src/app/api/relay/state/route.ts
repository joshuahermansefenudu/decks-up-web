import { NextResponse } from "next/server"

import { getRelayState } from "@/lib/relay/server-relay-pricing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lobbyCode = url.searchParams.get("lobbyCode")?.trim() ?? ""
  const playerId = url.searchParams.get("playerId")?.trim() ?? ""

  if (!lobbyCode || !playerId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  try {
    const state = await getRelayState({ lobbyCode, playerId })
    return NextResponse.json(state)
  } catch (routeError) {
    return NextResponse.json(
      { error: String((routeError as Error | undefined)?.message ?? routeError) },
      { status: 400 }
    )
  }
}


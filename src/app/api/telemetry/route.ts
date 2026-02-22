import { NextResponse } from "next/server"

export const runtime = "nodejs"

function sanitizePayload(input: unknown): Record<string, unknown> {
  const payload =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {}

  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase()
    if (
      lowerKey.includes("ip") ||
      lowerKey.includes("address") ||
      lowerKey.includes("candidate")
    ) {
      continue
    }
    output[key] = value
  }
  return output
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    timestampMs?: number
    payload?: unknown
  }

  if (!body.name) {
    return NextResponse.json({ error: "Missing event name." }, { status: 400 })
  }

  console.info("CLIENT_TELEMETRY", {
    name: body.name,
    timestampMs: body.timestampMs ?? Date.now(),
    payload: sanitizePayload(body.payload),
  })

  return NextResponse.json({ ok: true })
}


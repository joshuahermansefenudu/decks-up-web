import { NextResponse } from "next/server"

export const runtime = "nodejs"

type TwilioIceServer = {
  urls?: string | string[]
  url?: string
  username?: string
  credential?: string
}

type TwilioTokenResponse = {
  ice_servers?: TwilioIceServer[]
}

function normalizeIceServers(input: unknown): TwilioIceServer[] {
  if (!Array.isArray(input)) {
    return []
  }

  const servers: TwilioIceServer[] = []
  for (const server of input) {
    const record =
      typeof server === "object" && server !== null
        ? (server as Record<string, unknown>)
        : null
    if (!record) {
      continue
    }

    const urlsValue = record.urls ?? record.url
    const urls = Array.isArray(urlsValue)
      ? urlsValue.filter((item): item is string => typeof item === "string")
      : typeof urlsValue === "string"
        ? [urlsValue]
        : []
    if (!urls.length) {
      continue
    }

    const username =
      typeof record.username === "string" ? record.username : undefined
    const credential =
      typeof record.credential === "string" ? record.credential : undefined

    servers.push({
      urls,
      ...(username ? { username } : {}),
      ...(credential ? { credential } : {}),
    })
  }

  return servers
}

export async function GET() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio TURN is not configured." },
      { status: 500 }
    )
  }

  const formData = new URLSearchParams()
  const ttlValue = Number.parseInt(process.env.TWILIO_TURN_TTL ?? "", 10)
  if (Number.isFinite(ttlValue) && ttlValue > 0) {
    formData.set("Ttl", String(ttlValue))
  }

  try {
    const tokenResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        cache: "no-store",
      }
    )

    if (!tokenResponse.ok) {
      console.error("TWILIO_ICE_FETCH_FAILED", {
        status: tokenResponse.status,
      })
      return NextResponse.json(
        { error: "Unable to fetch ICE servers from Twilio." },
        { status: 502 }
      )
    }

    const tokenPayload = (await tokenResponse.json()) as TwilioTokenResponse
    const iceServers = normalizeIceServers(tokenPayload.ice_servers)

    if (!iceServers.length) {
      return NextResponse.json(
        { error: "Twilio returned no ICE servers." },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { iceServers },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("TWILIO_ICE_UNEXPECTED_ERROR", error)
    return NextResponse.json(
      { error: "Unexpected error while fetching Twilio ICE servers." },
      { status: 500 }
    )
  }
}

import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import { prisma } from "@/lib/prisma"
import {
  activateRelaySession,
  canPlayerEnableRelay,
} from "@/lib/relay/server-relay-pricing"
import { checkRateLimit } from "@/lib/sfu/server-rate-limit"

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

function normalizeIceServers(input: unknown): RTCIceServer[] {
  if (!Array.isArray(input)) {
    return []
  }
  const result: RTCIceServer[] = []
  for (const item of input) {
    const record =
      typeof item === "object" && item !== null
        ? (item as Record<string, unknown>)
        : null
    if (!record) {
      continue
    }

    const rawUrls = record.urls ?? record.url
    const urls = Array.isArray(rawUrls)
      ? rawUrls.filter((value): value is string => typeof value === "string")
      : typeof rawUrls === "string"
        ? [rawUrls]
        : []
    if (!urls.length) {
      continue
    }

    result.push({
      urls,
      ...(typeof record.username === "string"
        ? { username: record.username }
        : {}),
      ...(typeof record.credential === "string"
        ? { credential: record.credential }
        : {}),
    })
  }
  return result
}

function ensureTurnTransportServers(servers: RTCIceServer[]): RTCIceServer[] {
  const existing = new Set<string>()
  for (const server of servers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
    for (const value of urls) {
      if (typeof value === "string") {
        existing.add(value.toLowerCase())
      }
    }
  }

  const credentialed = servers.find(
    (server) =>
      typeof server.username === "string" &&
      typeof server.credential === "string"
  )
  if (!credentialed || typeof credentialed.username !== "string") {
    return servers
  }

  const required = [
    "turn:global.turn.twilio.com:3478?transport=udp",
    "turn:global.turn.twilio.com:3478?transport=tcp",
    "turns:global.turn.twilio.com:443?transport=tcp",
  ]

  const additions: RTCIceServer[] = required
    .filter((url) => !existing.has(url.toLowerCase()))
    .map((url) => ({
      urls: [url],
      username: credentialed.username,
      credential: credentialed.credential,
    }))

  return [...servers, ...additions]
}

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? ""
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown"
  const rateKey = `${user.id}:${ip}`
  const rateLimit = checkRateLimit(rateKey, {
    maxHits: 20,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many TURN token requests." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    )
  }

  const payload = (await request.json().catch(() => ({}))) as {
    roomId?: string
    participantId?: string
    lobbyCode?: string
    playerId?: string
    ttlSeconds?: number
  }
  const roomIdRaw = payload.roomId?.trim()
  const participantIdRaw = payload.participantId?.trim()
  const lobbyCodeRaw = payload.lobbyCode?.trim()
  const playerIdRaw = payload.playerId?.trim()
  const participantId = participantIdRaw || playerIdRaw
  const lobbyCode = lobbyCodeRaw
    ? lobbyCodeRaw.toUpperCase()
    : roomIdRaw
      ? roomIdRaw.toUpperCase()
      : ""

  if (!lobbyCode || !participantId) {
    return NextResponse.json(
      { error: "lobbyCode and playerId are required." },
      { status: 400 }
    )
  }

  const participant = await prisma.player.findUnique({
    where: {
      id: participantId,
    },
    include: {
      lobby: {
        select: {
          code: true,
        },
      },
    },
  })
  if (
    !participant ||
    participant.leftAt ||
    participant.authUserId !== user.id ||
    participant.lobby.code !== lobbyCode
  ) {
    return NextResponse.json(
      { error: "User is not an active participant in this room." },
      { status: 403 }
    )
  }

  const canEnable = await canPlayerEnableRelay({
    lobbyCode,
    playerId: participantId,
  })
  if (!canEnable) {
    return NextResponse.json(
      { error: "Relay is not approved or credits are unavailable." },
      { status: 403 }
    )
  }

  let relayActivation: Awaited<ReturnType<typeof activateRelaySession>>
  try {
    relayActivation = await activateRelaySession({
      lobbyCode,
      playerId: participantId,
    })
  } catch {
    return NextResponse.json(
      { error: "Relay is not approved or credits are unavailable." },
      { status: 403 }
    )
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "TURN provider is not configured." },
      { status: 500 }
    )
  }

  const ttlCandidate = Number.parseInt(String(payload.ttlSeconds ?? ""), 10)
  const ttlSeconds = Number.isFinite(ttlCandidate)
    ? Math.min(900, Math.max(300, ttlCandidate))
    : 600

  try {
    const form = new URLSearchParams()
    form.set("Ttl", String(ttlSeconds))

    const tokenResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Tokens.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        cache: "no-store",
      }
    )

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch TURN token." },
        { status: 502 }
      )
    }

    const twilioPayload = (await tokenResponse.json()) as TwilioTokenResponse
    const iceServers = ensureTurnTransportServers(
      normalizeIceServers(twilioPayload.ice_servers)
    )
    if (iceServers.length === 0) {
      return NextResponse.json(
        { error: "No TURN servers returned." },
        { status: 502 }
      )
    }

    // Security/privacy: do not log ICE candidates or endpoint addresses.
    console.info("TURN_TOKEN_ISSUED", {
      lobbyCode,
      authUserId: user.id,
      ttlSeconds,
      serverCount: iceServers.length,
      relayMode: relayActivation.mode,
      billedUserId: relayActivation.hostUserId,
    })

    // TODO(production hardening):
    // - Add WAF and anti-bot controls around this endpoint.
    // - Add per-room issuance caps and anomaly detection.
    // - Add immutable audit trail for issuance/consumption.

    return NextResponse.json({
      iceServers,
      relayMode: relayActivation.mode,
      billedUserId: relayActivation.hostUserId,
      relaySessionId: relayActivation.sessionId,
    })
  } catch {
    return NextResponse.json(
      { error: "Unexpected TURN token error." },
      { status: 500 }
    )
  }
}

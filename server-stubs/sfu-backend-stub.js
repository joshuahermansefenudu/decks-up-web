/**
 * DecksUp SFU backend stubs
 * Context metadata: 2026-02-19 America/Toronto
 *
 * This file is intentionally a standalone Node/Express reference stub.
 * It does NOT implement SFU media internals.
 * It provides:
 * - TURN token vending endpoint stub
 * - Credits endpoints stubs
 * - WebSocket signaling handlers for relay workflow + quality policy updates
 */

const http = require("node:http")
const express = require("express")
const { WebSocketServer } = require("ws")

const app = express()
app.use(express.json())

const CONFIG = {
  port: Number(process.env.PORT || 4010),
  turnTokenTtlSeconds: Number(process.env.TURN_TOKEN_TTL_SECONDS || 600),
  maxTurnTokenHitsPerMinute: Number(process.env.TURN_TOKEN_RATE_LIMIT || 20),
  relay: {
    maxRelayParticipants: 6,
    sessionMaxDurationMinutes: 120,
  },
  credits: {
    baseRateCreditsPerParticipantMinute: 1,
    allowPayAsYouGoOverage: false,
    overageRatePerMinuteCredits: 2,
  },
}

const rooms = new Map()
const wsByUserId = new Map()
const turnRateLimit = new Map()
const creditsByHost = new Map()

function nowMs() {
  return Date.now()
}

function verifyJwtStub(req, res, next) {
  const auth = req.headers.authorization || ""
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  // TODO(production): verify signature, exp, issuer, audience and revocation.
  // Stub: extract user id from a simple header for local testing.
  req.userId = req.headers["x-user-id"] || "stub-user"
  next()
}

function checkRateLimit(userId, ip) {
  const key = `${userId}:${ip}`
  const hit = turnRateLimit.get(key) || { hits: 0, resetAtMs: nowMs() + 60_000 }
  if (hit.resetAtMs <= nowMs()) {
    hit.hits = 0
    hit.resetAtMs = nowMs() + 60_000
  }
  hit.hits += 1
  turnRateLimit.set(key, hit)
  return hit.hits <= CONFIG.maxTurnTokenHitsPerMinute
}

function getRoomState(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      hostId: null,
      participants: new Set(),
      subscribersWithActivePlan: new Set(),
      relayApprovals: new Map(),
    })
  }
  return rooms.get(roomId)
}

function computeQualityPolicy(participantCount) {
  if (participantCount <= 3) {
    return { allowedLayers: ["MEDIUM", "HIGH"], recommendedMaxLayer: "HIGH" }
  }
  if (participantCount <= 6) {
    return { allowedLayers: ["MEDIUM"], recommendedMaxLayer: "MEDIUM" }
  }
  return { allowedLayers: ["LOW", "MEDIUM"], recommendedMaxLayer: "MEDIUM" }
}

async function fetchTwilioTurnTokenStub() {
  // TODO(production): call Twilio Network Traversal API with secret credentials.
  return [
    { urls: ["turn:global.turn.twilio.com:3478?transport=udp"], username: "stub", credential: "stub" },
    { urls: ["turn:global.turn.twilio.com:3478?transport=tcp"], username: "stub", credential: "stub" },
    { urls: ["turns:global.turn.twilio.com:443?transport=tcp"], username: "stub", credential: "stub" },
  ]
}

app.post("/api/turn-token", verifyJwtStub, async (req, res) => {
  const userId = String(req.userId)
  const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || "unknown")
  if (!checkRateLimit(userId, ip)) {
    res.status(429).json({ error: "Too many TURN requests" })
    return
  }

  const { roomId } = req.body || {}
  if (!roomId) {
    res.status(400).json({ error: "roomId required" })
    return
  }

  const room = getRoomState(String(roomId))
  if (!room.participants.has(userId)) {
    res.status(403).json({ error: "User is not in room" })
    return
  }

  const iceServers = await fetchTwilioTurnTokenStub()
  console.info("TURN_TOKEN_ISSUED", {
    roomId,
    userId,
    ttlSeconds: CONFIG.turnTokenTtlSeconds,
    count: iceServers.length,
  })

  // TODO(production hardening):
  // - WAF rules and abuse detection
  // - per-room issuance caps and replay protection
  // - immutable audit trails with requestId uniqueness checks
  res.json({ iceServers })
})

function getOrCreateCredit(hostId) {
  if (!creditsByHost.has(hostId)) {
    creditsByHost.set(hostId, {
      hostId,
      balance: 1000,
      reserved: 0,
      overageUsed: 0,
      notifications: [],
    })
  }
  return creditsByHost.get(hostId)
}

app.get("/api/credits/balance", verifyJwtStub, (req, res) => {
  const hostId = String(req.query.hostId || req.userId)
  res.json(getOrCreateCredit(hostId))
})

app.post("/api/credits/reserve", verifyJwtStub, (req, res) => {
  const hostId = String(req.body?.hostId || req.userId)
  const amount = Math.max(0, Number(req.body?.amount || 0))
  const credit = getOrCreateCredit(hostId)
  if (credit.balance >= amount) {
    credit.balance -= amount
    credit.reserved += amount
  }
  res.json(credit)
})

app.post("/api/credits/deduct", verifyJwtStub, (req, res) => {
  const hostId = String(req.body?.hostId || req.userId)
  const amount = Math.max(0, Number(req.body?.amount || 0))
  const credit = getOrCreateCredit(hostId)
  const fromReserved = Math.min(credit.reserved, amount)
  credit.reserved -= fromReserved
  const remainder = amount - fromReserved
  if (remainder > 0) {
    if (credit.balance >= remainder) {
      credit.balance -= remainder
    } else if (CONFIG.credits.allowPayAsYouGoOverage) {
      credit.overageUsed += remainder - credit.balance
      credit.balance = 0
    } else {
      credit.balance = 0
      credit.notifications.push("Relay disabled: balance exhausted.")
    }
  }
  res.json(credit)
})

app.post("/api/credits/release", verifyJwtStub, (req, res) => {
  const hostId = String(req.body?.hostId || req.userId)
  const amount = Math.max(0, Number(req.body?.amount || 0))
  const credit = getOrCreateCredit(hostId)
  const releasable = Math.min(credit.reserved, amount)
  credit.reserved -= releasable
  credit.balance += releasable
  res.json(credit)
})

app.post("/api/credits/subscription-renewal", verifyJwtStub, (req, res) => {
  const hostId = String(req.body?.hostId || req.userId)
  const credit = getOrCreateCredit(hostId)
  credit.notifications.push("Subscription renewal processed (stub).")
  res.json(credit)
})

app.get("/api/credits/notifications", verifyJwtStub, (req, res) => {
  const hostId = String(req.query.hostId || req.userId)
  const credit = getOrCreateCredit(hostId)
  const notifications = [...credit.notifications]
  credit.notifications = []
  res.json({ hostId, notifications })
})

app.post("/api/telemetry", (req, res) => {
  const body = req.body || {}
  const payload = body.payload || {}
  // Privacy: do not ingest raw ICE candidate/IP addresses in this stub.
  delete payload.candidate
  delete payload.ip
  delete payload.address
  console.info("TELEMETRY", { name: body.name, payload, timestampMs: body.timestampMs || nowMs() })
  res.json({ ok: true })
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: "/ws" })

function wsSend(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

function broadcastRoom(roomId, message) {
  const room = getRoomState(roomId)
  for (const userId of room.participants) {
    const ws = wsByUserId.get(userId)
    if (ws) {
      wsSend(ws, message)
    }
  }
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost")
  const userId = String(url.searchParams.get("userId") || "unknown")
  const roomId = String(url.searchParams.get("roomId") || "")
  if (!roomId || userId === "unknown") {
    ws.close(1008, "Missing userId/roomId")
    return
  }

  wsByUserId.set(userId, ws)
  const room = getRoomState(roomId)
  room.participants.add(userId)
  if (!room.hostId) {
    room.hostId = userId
  }

  const quality = computeQualityPolicy(room.participants.size)
  broadcastRoom(roomId, {
    type: "QUALITY_POLICY_UPDATED",
    payload: {
      roomId,
      participantCount: room.participants.size,
      ...quality,
    },
  })

  ws.on("message", (raw) => {
    let message
    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }

    // Signaling protocol stubs:
    // RELAY_REQUEST { requestId, roomId, requesterId }
    // RELAY_DECISION { requestId, roomId, approved, maxMinutesGranted?, note? }
    // QUALITY_POLICY_UPDATED (server broadcast)
    if (message.type === "RELAY_REQUEST") {
      const requesterId = String(message.payload?.requesterId || "")
      const hostWs = wsByUserId.get(room.hostId)
      wsSend(hostWs, {
        type: "RELAY_REQUEST",
        payload: {
          requestId: message.payload?.requestId,
          roomId,
          requesterId,
        },
      })
      return
    }

    if (message.type === "RELAY_DECISION") {
      const requesterId = String(message.payload?.requesterId || "")
      const approverId = userId
      const isHost = approverId === room.hostId
      const isActiveSubscriber = room.subscribersWithActivePlan.has(approverId)
      if (!isHost && !isActiveSubscriber) {
        wsSend(ws, { type: "ERROR", payload: { message: "Not allowed to approve relay." } })
        return
      }

      room.relayApprovals.set(message.payload?.requestId, {
        requesterId,
        approved: Boolean(message.payload?.approved),
        maxMinutesGranted: Number(message.payload?.maxMinutesGranted || 0),
      })

      const target = wsByUserId.get(requesterId)
      wsSend(target, {
        type: "RELAY_DECISION",
        payload: {
          requestId: message.payload?.requestId,
          roomId,
          requesterId,
          approved: Boolean(message.payload?.approved),
          maxMinutesGranted: Number(message.payload?.maxMinutesGranted || 0),
          note: message.payload?.note || "",
        },
      })
      return
    }

    if (message.type === "SUBSCRIPTION_QUALITY_HINTS") {
      // Forward to SFU control plane in a real deployment.
      // Stub acknowledges.
      wsSend(ws, { type: "ACK", payload: { type: "SUBSCRIPTION_QUALITY_HINTS" } })
    }
  })

  ws.on("close", () => {
    room.participants.delete(userId)
    wsByUserId.delete(userId)

    const quality = computeQualityPolicy(room.participants.size)
    broadcastRoom(roomId, {
      type: "QUALITY_POLICY_UPDATED",
      payload: {
        roomId,
        participantCount: room.participants.size,
        ...quality,
      },
    })
  })
})

server.listen(CONFIG.port, () => {
  console.log(`SFU stub server listening on http://localhost:${CONFIG.port}`)
})


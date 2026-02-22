import { SFU_CONFIG } from "@/lib/sfu/config"
import type { TelemetryEventName } from "@/lib/sfu/types"

// Sample JSON schema for telemetry events:
// {
//   "name": "SELECTED_CANDIDATE",
//   "timestampMs": 1771459200000,
//   "roomId": "ROOM123",
//   "participantId": "user_42",
//   "payload": {
//     "candidateType": "relay",
//     "relayProtocol": "tcp"
//   }
// }
//
// Core metrics to compute from logs:
// 1) P2P success rate:
//    connected sessions where selectedCandidateType != relay / all attempts
// 2) Relay hours consumed:
//    total relay-active seconds per room / per host
// 3) Credit trend / churn risk:
//    balance slope, exhaustion frequency, denied-relay rate

type JsonRecord = Record<string, unknown>

function sanitizeTelemetryPayload(payload: JsonRecord): JsonRecord {
  const result: JsonRecord = {}
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase()

    // Privacy guard: avoid IP/candidate-address logging.
    if (
      lowerKey.includes("ip") ||
      lowerKey.includes("address") ||
      lowerKey.includes("candidate")
    ) {
      continue
    }

    result[key] = value
  }
  return result
}

export async function logEvent(
  name: TelemetryEventName,
  payload: JsonRecord
): Promise<void> {
  try {
    await fetch(SFU_CONFIG.signaling.telemetryPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        timestampMs: Date.now(),
        payload: sanitizeTelemetryPayload(payload),
      }),
      keepalive: true,
    })
  } catch {
    // Non-blocking: telemetry should never break gameplay.
  }
}


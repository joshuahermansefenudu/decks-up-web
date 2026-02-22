// DecksUp SFU migration context metadata:
// Date: 2026-02-19
// Region: America/Toronto

export type SimulcastLayer = "LOW" | "MEDIUM" | "HIGH"
export type VideoProfileMode = "normal" | "relay"

export type SubscriptionPolicy = {
  roomId: string
  participantCount: number
  allowedLayers: SimulcastLayer[]
  recommendedMaxLayer: SimulcastLayer
}

export type RelayRequest = {
  requestId: string
  roomId: string
  requesterId: string
  timestampMs: number
}

export type RelayDecision = {
  requestId: string
  roomId: string
  approved: boolean
  maxMinutesGranted?: number
  note?: string
  decidedBy: string
  timestampMs: number
}

export type SelectedCandidate = {
  candidateType: "host" | "srflx" | "relay" | "prflx" | "unknown"
  relayProtocol?: "udp" | "tcp" | "tls" | "unknown"
}

export type TelemetryEventName =
  | "ICE_STATE_CHANGED"
  | "SFU_CONNECTED"
  | "SFU_DISCONNECTED"
  | "RELAY_REQUESTED"
  | "RELAY_APPROVED"
  | "RELAY_DENIED"
  | "RELAY_STARTED"
  | "RELAY_STOPPED"
  | "SELECTED_CANDIDATE"
  | "DEDUCT_TICK"
  | "VIDEO_PROFILE_APPLIED"

export type WsEnvelope =
  | {
      type: "RELAY_REQUEST"
      payload: RelayRequest
    }
  | {
      type: "RELAY_DECISION"
      payload: RelayDecision
    }
  | {
      type: "QUALITY_POLICY_UPDATED"
      payload: SubscriptionPolicy
    }
  | {
      type: "SUBSCRIPTION_QUALITY_HINTS"
      payload: {
        roomId: string
        participantId: string
        maxLayer: SimulcastLayer
        preferredDimensions: { width: number; height: number }
      }
    }
  | {
      type: "SFU_OFFER" | "SFU_ANSWER" | "SFU_ICE"
      payload: {
        roomId: string
        participantId: string
        sdp?: RTCSessionDescriptionInit
        candidate?: RTCIceCandidateInit
      }
    }


"use client"

import { SFU_CONFIG } from "@/lib/sfu/config"
import type {
  RelayDecision,
  RelayRequest,
  SelectedCandidate,
  SimulcastLayer,
  SubscriptionPolicy,
  VideoProfileMode,
  WsEnvelope,
} from "@/lib/sfu/types"
import { logEvent } from "@/lib/sfu/telemetry"
import { createRelayUiController } from "@/lib/sfu/relay-ui-state"
import {
  createDefaultCreditRuntimeState,
  deductCreditsTick as deductCreditsTickCore,
  enforceRelayCaps as enforceRelayCapsCore,
  type CreditRuntimeState,
} from "@/lib/sfu/credits"

type SfuClientOptions = {
  roomId: string
  participantId: string
  hostId: string
  authToken: string
  signalingSocket: WebSocket
  localStream: MediaStream
  onRemoteTrack?: (event: RTCTrackEvent) => void
  onBanner?: (message: string) => void
}

type RelayUsageWatcher = {
  stop: () => void
}

export type SfuConnection = {
  pc: RTCPeerConnection
  roomId: string
  participantId: string
  hostId: string
  authToken: string
  signalingSocket: WebSocket
  localStream: MediaStream
  creditState: CreditRuntimeState
  relayEnabled: boolean
  relayApprovedRequestIds: Set<string>
  onRemoteTrack?: (event: RTCTrackEvent) => void
  onBanner?: (message: string) => void
}

let activeSfuConnection: SfuConnection | null = null

function requireConnection(connection?: SfuConnection): SfuConnection {
  if (connection) {
    return connection
  }
  if (!activeSfuConnection) {
    throw new Error("No active SFU connection.")
  }
  return activeSfuConnection
}

function getAllowedLayersFromCount(participantCount: number): SimulcastLayer[] {
  if (participantCount <= 3) {
    return ["MEDIUM", "HIGH"]
  }
  if (participantCount <= 6) {
    return ["MEDIUM"]
  }
  return ["LOW", "MEDIUM"]
}

function getPolicyFromCount(
  roomId: string,
  participantCount: number
): SubscriptionPolicy {
  const allowedLayers = getAllowedLayersFromCount(participantCount)
  return {
    roomId,
    participantCount,
    allowedLayers,
    recommendedMaxLayer: allowedLayers[allowedLayers.length - 1] ?? "LOW",
  }
}

function maxLayerToDimensions(layer: SimulcastLayer) {
  if (layer === "HIGH") {
    return { width: 960, height: 540 }
  }
  if (layer === "MEDIUM") {
    return { width: 640, height: 360 }
  }
  return { width: 320, height: 180 }
}

export function applySubscriptionQualityPolicy(
  connection: SfuConnection,
  policy: SubscriptionPolicy
): void {
  // SFU-side subscription quality control:
  // We send preferred dimensions + max layer to the SFU signaling plane.
  // This allows server-driven adaptation without mesh renegotiation.
  const maxLayer = policy.recommendedMaxLayer
  sendSignal(connection.signalingSocket, {
    type: "SUBSCRIPTION_QUALITY_HINTS",
    payload: {
      roomId: connection.roomId,
      participantId: connection.participantId,
      maxLayer,
      preferredDimensions: maxLayerToDimensions(maxLayer),
    },
  })
}

function sendSignal(socket: WebSocket, envelope: WsEnvelope) {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }
  socket.send(JSON.stringify(envelope))
}

export async function applySimulcast(
  senderOrTrack: RTCRtpSender | MediaStreamTrack,
  pc?: RTCPeerConnection
): Promise<void> {
  const sender =
    "track" in senderOrTrack
      ? senderOrTrack
      : pc?.getSenders().find((candidate) => candidate.track === senderOrTrack)

  if (!sender || sender.track?.kind !== "video") {
    return
  }

  const parameters = sender.getParameters()
  parameters.encodings = [
    {
      rid: SFU_CONFIG.quality.simulcast.low.rid,
      scaleResolutionDownBy: SFU_CONFIG.quality.simulcast.low.scaleResolutionDownBy,
      maxBitrate: SFU_CONFIG.quality.simulcast.low.maxBitrate,
      maxFramerate: SFU_CONFIG.quality.simulcast.low.maxFramerate,
      active: true,
    },
    {
      rid: SFU_CONFIG.quality.simulcast.medium.rid,
      scaleResolutionDownBy:
        SFU_CONFIG.quality.simulcast.medium.scaleResolutionDownBy,
      maxBitrate: SFU_CONFIG.quality.simulcast.medium.maxBitrate,
      maxFramerate: SFU_CONFIG.quality.simulcast.medium.maxFramerate,
      active: true,
    },
    {
      rid: SFU_CONFIG.quality.simulcast.high.rid,
      scaleResolutionDownBy: SFU_CONFIG.quality.simulcast.high.scaleResolutionDownBy,
      maxBitrate: SFU_CONFIG.quality.simulcast.high.maxBitrate,
      maxFramerate: SFU_CONFIG.quality.simulcast.high.maxFramerate,
      active: true,
    },
  ]

  try {
    await sender.setParameters(parameters)
  } catch {
    // Some browsers require transceiver-level setup for RID encodings.
  }
}

export async function setVideoProfile(
  mode: VideoProfileMode,
  connection?: SfuConnection
): Promise<void> {
  const resolved = requireConnection(connection)
  const profile = SFU_CONFIG.quality.profiles[mode]
  const videoTrack = resolved.localStream.getVideoTracks()[0]

  if (videoTrack) {
    try {
      await videoTrack.applyConstraints({
        width: { ideal: profile.width, max: profile.width },
        height: { ideal: profile.height, max: profile.height },
        frameRate: { ideal: profile.frameRate, max: profile.frameRate },
      })
    } catch {
      // Constraint support differs by browser/device.
    }
  }

  await Promise.all(
    resolved.pc.getSenders().map(async (sender) => {
      if (sender.track?.kind !== "video") {
        return
      }
      const parameters = sender.getParameters()
      const encodings =
        parameters.encodings && parameters.encodings.length > 0
          ? [...parameters.encodings]
          : [{}]
      encodings[0] = {
        ...encodings[0],
        maxBitrate: profile.maxBitrate,
        maxFramerate: profile.frameRate,
      }
      try {
        await sender.setParameters({ ...parameters, encodings })
      } catch {
        // Non-fatal in browsers with sender parameter restrictions.
      }
    })
  )

  await logEvent("VIDEO_PROFILE_APPLIED", {
    roomId: resolved.roomId,
    participantId: resolved.participantId,
    profile: mode,
  })
}

export function detectRelayUsage(
  connectionOrCallback?: SfuConnection | ((selected: SelectedCandidate) => void),
  onUpdate?: (selected: SelectedCandidate) => void
): RelayUsageWatcher {
  const resolved =
    typeof connectionOrCallback === "object"
      ? requireConnection(connectionOrCallback)
      : requireConnection()
  const callback =
    typeof connectionOrCallback === "function" ? connectionOrCallback : onUpdate
  let stopped = false

  const tick = async () => {
    if (stopped) {
      return
    }

    try {
      const stats = await resolved.pc.getStats()
      let pair: RTCIceCandidatePairStats | null = null

      stats.forEach((report) => {
        if (report.type === "candidate-pair") {
          const candidatePair = report as RTCIceCandidatePairStats
          if (candidatePair.nominated && candidatePair.state === "succeeded") {
            pair = candidatePair
          }
        }
      })

      const localCandidateId =
        pair &&
        typeof (pair as Record<string, unknown>).localCandidateId === "string"
          ? ((pair as Record<string, unknown>).localCandidateId as string)
          : ""

      if (localCandidateId) {
        const local = stats.get(localCandidateId)
        const candidateType =
          local &&
          typeof (local as Record<string, unknown>).candidateType === "string"
            ? ((local as Record<string, unknown>).candidateType as
                | "host"
                | "srflx"
                | "relay"
                | "prflx")
            : "unknown"
        const relayProtocol =
          local && typeof (local as Record<string, unknown>).relayProtocol === "string"
            ? ((local as Record<string, unknown>).relayProtocol as
                | "udp"
                | "tcp"
                | "tls")
            : "unknown"

        const selected: SelectedCandidate = {
          candidateType,
          relayProtocol,
        }

        callback?.(selected)
        void logEvent("SELECTED_CANDIDATE", {
          roomId: resolved.roomId,
          participantId: resolved.participantId,
          candidateType: selected.candidateType,
          relayProtocol: selected.relayProtocol,
        })
      }
    } catch {
      // Stats polling should not disrupt media.
    } finally {
      if (!stopped) {
        window.setTimeout(tick, SFU_CONFIG.quality.relayDetectPollMs)
      }
    }
  }

  void tick()

  return {
    stop() {
      stopped = true
    },
  }
}

export async function fetchTurnToken(authToken?: string): Promise<RTCIceServer[]> {
  const resolved = requireConnection()
  const token = authToken ?? resolved.authToken
  const response = await fetch(SFU_CONFIG.signaling.turnTokenPath, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ttlSeconds: SFU_CONFIG.ice.relayTokenTtlSeconds,
      roomId: resolved.roomId,
      participantId: resolved.participantId,
      lobbyCode: resolved.roomId,
      playerId: resolved.participantId,
    }),
  })

  if (!response.ok) {
    throw new Error("TURN token request failed.")
  }

  const payload = (await response.json()) as { iceServers?: RTCIceServer[] }
  if (!payload.iceServers || payload.iceServers.length === 0) {
    throw new Error("TURN token response did not include ICE servers.")
  }
  return payload.iceServers
}

async function restartIceWithTurn(
  connection: SfuConnection,
  turnServers: RTCIceServer[]
) {
  try {
    const current = connection.pc.getConfiguration()
    connection.pc.setConfiguration({
      ...current,
      iceServers: [...SFU_CONFIG.ice.stunOnlyServers, ...turnServers],
    })
    const offer = await connection.pc.createOffer({ iceRestart: true })
    await connection.pc.setLocalDescription(offer)
    sendSignal(connection.signalingSocket, {
      type: "SFU_OFFER",
      payload: {
        roomId: connection.roomId,
        participantId: connection.participantId,
        sdp: offer,
      },
    })
  } catch {
    // If restart fails in this browser, recreate one SFU session (still no mesh).
    const freshPc = new RTCPeerConnection({
      iceServers: [...SFU_CONFIG.ice.stunOnlyServers, ...turnServers],
    })
    connection.pc.close()
    connection.pc = freshPc
    connection.localStream.getTracks().forEach((track) => {
      const sender = freshPc.addTrack(track, connection.localStream)
      void applySimulcast(sender)
    })
  }
}

export async function enableRelayForParticipant(
  requesterId: string,
  requestId: string
): Promise<void> {
  const connection = requireConnection()
  const relayRequest: RelayRequest = {
    requestId,
    roomId: connection.roomId,
    requesterId,
    timestampMs: Date.now(),
  }

  sendSignal(connection.signalingSocket, {
    type: "RELAY_REQUEST",
    payload: relayRequest,
  })
  await logEvent("RELAY_REQUESTED", relayRequest)
}

export function hostApproveRelay(
  requestId: string,
  approved: boolean,
  maxMinutesGranted?: number,
  note?: string
): void {
  const connection = requireConnection()
  const payload: RelayDecision = {
    requestId,
    roomId: connection.roomId,
    approved,
    maxMinutesGranted,
    note,
    decidedBy: connection.participantId,
    timestampMs: Date.now(),
  }
  sendSignal(connection.signalingSocket, {
    type: "RELAY_DECISION",
    payload,
  })
  void logEvent(approved ? "RELAY_APPROVED" : "RELAY_DENIED", payload)
}

export async function createSFUConnection(
  options: SfuClientOptions
): Promise<SfuConnection> {
  // Single SFU session per client. No per-peer mesh RTCPeerConnection instances.
  const pc = new RTCPeerConnection({
    iceServers: SFU_CONFIG.ice.stunOnlyServers,
  })

  const seedCredits = Number.parseInt(
    process.env.NEXT_PUBLIC_SFU_HOST_CREDITS ?? "600",
    10
  )
  const connection: SfuConnection = {
    pc,
    roomId: options.roomId,
    participantId: options.participantId,
    hostId: options.hostId,
    authToken: options.authToken,
    signalingSocket: options.signalingSocket,
    localStream: options.localStream,
    creditState: createDefaultCreditRuntimeState(
      options.roomId,
      options.hostId,
      Number.isFinite(seedCredits) ? Math.max(0, seedCredits) : 600
    ),
    relayEnabled: false,
    relayApprovedRequestIds: new Set<string>(),
    onRemoteTrack: options.onRemoteTrack,
    onBanner: options.onBanner,
  }

  options.localStream.getTracks().forEach((track) => {
    const sender = pc.addTrack(track, options.localStream)
    if (track.kind === "video") {
      void applySimulcast(sender)
    }
  })

  await setVideoProfile("normal", connection)

  const relayUi = createRelayUiController()

  pc.ontrack = (event) => {
    connection.onRemoteTrack?.(event)
  }

  pc.onicecandidate = (event) => {
    if (!event.candidate) {
      return
    }
    sendSignal(connection.signalingSocket, {
      type: "SFU_ICE",
      payload: {
        roomId: connection.roomId,
        participantId: connection.participantId,
        candidate: event.candidate.toJSON(),
      },
    })
  }

  pc.oniceconnectionstatechange = () => {
    void logEvent("ICE_STATE_CHANGED", {
      roomId: connection.roomId,
      participantId: connection.participantId,
      newState: pc.iceConnectionState,
    })

    if (pc.iceConnectionState === "failed") {
      const uiState = relayUi.onIceFailure()
      connection.onBanner?.(uiState.bannerText)
    }
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      void logEvent("SFU_CONNECTED", {
        roomId: connection.roomId,
        participantId: connection.participantId,
      })
    }
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      void logEvent("SFU_DISCONNECTED", {
        roomId: connection.roomId,
        participantId: connection.participantId,
        state: pc.connectionState,
      })
    }
  }

  options.signalingSocket.addEventListener("message", async (event) => {
    const envelope = JSON.parse(event.data) as WsEnvelope

    if (envelope.type === "SFU_ANSWER" && envelope.payload.sdp) {
      await pc.setRemoteDescription(envelope.payload.sdp)
      return
    }

    if (envelope.type === "SFU_ICE" && envelope.payload.candidate) {
      await pc.addIceCandidate(envelope.payload.candidate)
      return
    }

    if (
      envelope.type === "QUALITY_POLICY_UPDATED" &&
      envelope.payload.roomId === connection.roomId
    ) {
      applySubscriptionQualityPolicy(connection, envelope.payload)
      return
    }

    if (
      envelope.type === "RELAY_DECISION" &&
      envelope.payload.roomId === connection.roomId
    ) {
      if (!envelope.payload.approved) {
        connection.onBanner?.("Relay request denied. Staying in direct mode.")
        return
      }

      try {
        connection.relayApprovedRequestIds.add(envelope.payload.requestId)
        const turnServers = await fetchTurnToken()
        await restartIceWithTurn(connection, turnServers)
        connection.relayEnabled = true
        await setVideoProfile("relay", connection)
        connection.onBanner?.("Relay active. Using host hours.")
        await logEvent("RELAY_STARTED", {
          roomId: connection.roomId,
          participantId: connection.participantId,
          requestId: envelope.payload.requestId,
        })
      } catch {
        connection.onBanner?.("Relay setup failed. Staying on direct mode.")
      }
    }
  })

  const initialPolicy = getPolicyFromCount(connection.roomId, 1)
  applySubscriptionQualityPolicy(connection, initialPolicy)
  activeSfuConnection = connection

  return connection
}

export async function deductCreditsTick(
  connection?: SfuConnection
): Promise<void> {
  const resolved = requireConnection(connection)
  resolved.creditState = await deductCreditsTickCore(resolved.creditState)
}

export function enforceRelayCaps(connection?: SfuConnection): void {
  const resolved = requireConnection(connection)
  const result = enforceRelayCapsCore(resolved.creditState)
  resolved.creditState = result.nextState

  if (result.revokedRequesterIds.length > 0) {
    resolved.onBanner?.("Relay limit reached or host balance exhausted.")
  }

  if (result.shouldEndRelay && resolved.relayEnabled) {
    resolved.relayEnabled = false
    void setVideoProfile("normal", resolved)
    void logEvent("RELAY_STOPPED", {
      roomId: resolved.roomId,
      participantId: resolved.participantId,
      reason: "caps_or_credits",
    })
  }
}

export function startRelayCreditTick(connection: SfuConnection): () => void {
  const timerId = window.setInterval(async () => {
    if (!connection.relayEnabled) {
      return
    }
    await deductCreditsTick(connection)
    enforceRelayCaps(connection)
  }, SFU_CONFIG.credits.tickMs)

  return () => {
    window.clearInterval(timerId)
  }
}

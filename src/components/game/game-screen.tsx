"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"
import AdSlot from "@/components/ads/AdSlot"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { useKeepScreenAwake } from "@/lib/useKeepScreenAwake"
import { useTurnTimer } from "@/hooks/useTurnTimer"
import { useHeadAnchor } from "@/lib/virtual/useHeadAnchor"
import { TurnOverlayCard } from "@/components/virtual/TurnOverlayCard"

const FEEDBACK_FORM_URL =
  process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL?.trim() ||
  "https://docs.google.com/forms/d/e/1FAIpQLScnT3O2wxHikAl1w5PpMY6L4efPyuN_DoDi08mUng74I-dcBQ/viewform?usp=publish-editor"

type Player = {
  id: string
  name: string
  isHost: boolean
}

type Card = {
  id: string
  title: string
  publicUrl: string
}

type GameState = {
  lobby: {
    id: string
    code: string
    status: string
    mode: "IN_PERSON" | "VIRTUAL"
    activePlayerId: string | null
    currentCardIndex: number
    currentTurnIndex: number
  }
  players: Player[]
  photos: {
    currentCard: Card | null
  }
}

type GameScreenProps = {
  initialState: GameState
  playerId?: string
}

type PeerTransportMode = "p2p" | "relay"

type VideoTileProps = {
  stream: MediaStream | null
  name: string
  isActive: boolean
  isSelf: boolean
  showPlaceholder: boolean
  card: Card | null
}

function VideoTile({
  stream,
  name,
  isActive,
  isSelf,
  showPlaceholder,
  card,
}: VideoTileProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const trackingEnabled = isActive && Boolean(stream)
  const anchor = useHeadAnchor(videoRef, trackingEnabled)
  const hasVideo = Boolean(
    stream?.getVideoTracks().some((track) => track.enabled)
  )

  React.useEffect(() => {
    if (!videoRef.current) {
      return
    }
    if (stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const isGuesserViewer = isActive && isSelf && showPlaceholder
  const activeCard = isActive && !isSelf ? card : null

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl border-2 border-black bg-black/5 shadow-[3px_3px_0_#000] transition-all duration-300 ${
        isActive ? "ring-4 ring-primary" : ""
      }`}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-lightgray text-xs font-semibold uppercase tracking-wide text-black/60">
          Camera loading
        </div>
      )}
      {stream && !hasVideo ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs font-semibold uppercase tracking-wide text-offwhite">
          Camera off
        </div>
      ) : null}

      <div
        className={`absolute bottom-2 left-2 rounded-full border-2 border-black bg-offwhite font-semibold uppercase tracking-wide text-black ${
          isActive
            ? "px-2 py-1 text-xs shadow-[2px_2px_0_#000]"
            : "px-1.5 py-0.5 text-[8px]"
        }`}
      >
        {name}
        {isSelf ? " (You)" : ""}
      </div>

      {isActive ? (
        <div className="absolute top-2 left-2 rounded-full border-2 border-black bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]">
          Guesser
        </div>
      ) : null}

      {isActive ? (
        <TurnOverlayCard
          anchorX={anchor.x}
          anchorY={anchor.y}
          trackingVisible={anchor.visible}
          isGuesserViewer={isGuesserViewer}
          card={activeCard}
        />
      ) : null}
    </div>
  )
}

function GameScreen({ initialState, playerId }: GameScreenProps) {
  const router = useRouter()
  const [state, setState] = React.useState(initialState)
  const [hasSeenTutorial, setHasSeenTutorial] = React.useState(false)
  const [countdown, setCountdown] = React.useState<number | null>(null)
  const [showCard, setShowCard] = React.useState(false)
  const [lastTurnIndex, setLastTurnIndex] = React.useState<number | null>(null)
  const [actionError, setActionError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = React.useState<
    Record<string, MediaStream>
  >({})
  const [mediaError, setMediaError] = React.useState("")
  const [webrtcStatus, setWebrtcStatus] = React.useState("")
  const [signalStatus, setSignalStatus] = React.useState("idle")
  const [iceStatus, setIceStatus] = React.useState("")
  const [signalDebug, setSignalDebug] = React.useState("")
  const [isMicMuted, setIsMicMuted] = React.useState(false)
  const [isVideoMuted, setIsVideoMuted] = React.useState(false)
  const isAdvancingRef = React.useRef(false)
  const peersRef = React.useRef<Map<string, RTCPeerConnection>>(new Map())
  const peerModeRef = React.useRef<Map<string, PeerTransportMode>>(new Map())
  const relayAttemptedRef = React.useRef<Map<string, boolean>>(new Map())
  const relayCandidateSeenRef = React.useRef<Map<string, boolean>>(new Map())
  const iceTypesRef = React.useRef<Map<string, Set<string>>>(new Map())
  const signalCountsRef = React.useRef({
    readySent: 0,
    readyReceived: 0,
    offerSent: 0,
    offerReceived: 0,
    answerSent: 0,
    answerReceived: 0,
    iceSent: 0,
    iceReceived: 0,
  })
  const offerAttemptAtRef = React.useRef<Map<string, number>>(new Map())
  const pendingIceRef = React.useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  )
  const connectTimeoutsRef = React.useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map())
  const channelRef = React.useRef<ReturnType<
    typeof supabaseBrowser.channel
  > | null>(null)
  const p2pIceServers = React.useMemo<RTCIceServer[]>(
    () => [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
    []
  )
  const turnServers = React.useMemo<RTCIceServer[]>(() => {
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL ?? ""
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME ?? ""
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? ""
    const baseUrls = turnUrl
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean)

    if (!baseUrls.length || !turnUsername || !turnCredential) {
      return []
    }

    const urls = new Set(baseUrls)
    const first = baseUrls[0] ?? ""
    const match = first.match(/^(?:turns?:)?([^:/?]+)/i)
    const host = match?.[1]

    if (host) {
      urls.add(`turn:${host}:80?transport=tcp`)
      urls.add(`turn:${host}:443?transport=tcp`)
      urls.add(`turns:${host}:443?transport=tcp`)
    }

    return [
      {
        urls: Array.from(urls),
        username: turnUsername,
        credential: turnCredential,
      },
    ]
  }, [])
  const hasTurnServer = turnServers.length > 0
  const forceTurn = process.env.NEXT_PUBLIC_FORCE_TURN === "true"

  const updateSignalDebug = React.useCallback(() => {
    const c = signalCountsRef.current
    setSignalDebug(
      `S:ready ${c.readySent}/${c.readyReceived} | offer ${c.offerSent}/${c.offerReceived} | answer ${c.answerSent}/${c.answerReceived} | ice ${c.iceSent}/${c.iceReceived}`
    )
  }, [])

  const bumpSignalCount = React.useCallback(
    (
      key:
        | "readySent"
        | "readyReceived"
        | "offerSent"
        | "offerReceived"
        | "answerSent"
        | "answerReceived"
        | "iceSent"
        | "iceReceived"
    ) => {
      signalCountsRef.current[key] += 1
      updateSignalDebug()
    },
    [updateSignalDebug]
  )

  const fetchState = React.useCallback(async () => {
    const response = await fetch(
      `/api/lobbies/${initialState.lobby.code}?playerId=${playerId ?? ""}`
    )
    if (!response.ok) {
      return
    }
    const payload = (await response.json()) as GameState
    setState(payload)
  }, [initialState.lobby.code, playerId])

  type SignalPayload = {
    type: "ready" | "offer" | "answer" | "ice"
    from: string
    to?: string
    sdp?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
    transport?: PeerTransportMode
  }

  const sendSignal = React.useCallback((payload: SignalPayload) => {
    const channel = channelRef.current
    if (!channel) {
      return
    }

    if (payload.type === "ready") {
      bumpSignalCount("readySent")
    } else if (payload.type === "offer") {
      bumpSignalCount("offerSent")
    } else if (payload.type === "answer") {
      bumpSignalCount("answerSent")
    } else if (payload.type === "ice") {
      bumpSignalCount("iceSent")
    }

    void channel
      .send({
        type: "broadcast",
        event: "signal",
        payload,
      })
      .then((result) => {
        if (result !== "ok") {
          setWebrtcStatus(`Signal send failed (${result}).`)
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.log("SIGNAL_SEND_ERROR", error)
        }
        setWebrtcStatus("Signal send failed.")
      })
  }, [bumpSignalCount])

  const cleanupPeer = React.useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId)
    if (peer) {
      peer.ontrack = null
      peer.onicecandidate = null
      peer.onconnectionstatechange = null
      peer.oniceconnectionstatechange = null
      peer.close()
    }

    const timeoutId = connectTimeoutsRef.current.get(peerId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      connectTimeoutsRef.current.delete(peerId)
    }

    peersRef.current.delete(peerId)
    peerModeRef.current.delete(peerId)
    relayAttemptedRef.current.delete(peerId)
    relayCandidateSeenRef.current.delete(peerId)
    iceTypesRef.current.delete(peerId)
    offerAttemptAtRef.current.delete(peerId)
    pendingIceRef.current.delete(peerId)
    setRemoteStreams((current) => {
      if (!current[peerId]) {
        return current
      }
      const next = { ...current }
      delete next[peerId]
      return next
    })
  }, [])

  const scheduleConnectTimeout = React.useCallback(
    (peerId: string, mode: PeerTransportMode) => {
      const existing = connectTimeoutsRef.current.get(peerId)
      if (existing) {
        clearTimeout(existing)
      }

      const timeoutMs = mode === "p2p" ? 9000 : 12000
      const timeoutId = setTimeout(() => {
        const peer = peersRef.current.get(peerId)
        if (!peer) {
          return
        }

        if (
          peer.connectionState === "connected" ||
          peer.iceConnectionState === "connected" ||
          peer.iceConnectionState === "completed"
        ) {
          return
        }

        if (
          mode === "p2p" &&
          hasTurnServer &&
          !relayAttemptedRef.current.get(peerId) &&
          playerId
        ) {
          setWebrtcStatus("P2P unstable. Retrying video through TURN relay...")
          relayAttemptedRef.current.set(peerId, true)
          cleanupPeer(peerId)
          peerModeRef.current.set(peerId, "relay")
          sendSignal({
            type: "ready",
            from: playerId,
            to: peerId,
            transport: "relay",
          })
          return
        }

        if (mode === "p2p" && !hasTurnServer) {
          setWebrtcStatus(
            "P2P failed and TURN fallback is not configured in this deployment."
          )
        }

        if (mode === "relay" && !relayCandidateSeenRef.current.get(peerId)) {
          setWebrtcStatus(
            "TURN relay could not be established. Check TURN credentials and ports."
          )
          cleanupPeer(peerId)
          return
        }

        cleanupPeer(peerId)
        setWebrtcStatus(
          "Video connection failed for a player. Ask both players to refresh."
        )
      }, timeoutMs)

      connectTimeoutsRef.current.set(peerId, timeoutId)
    },
    [cleanupPeer, hasTurnServer, playerId, sendSignal]
  )

  const flushPendingIce = React.useCallback(
    async (peerId: string, peer: RTCPeerConnection) => {
      const queued = pendingIceRef.current.get(peerId) ?? []
      if (!queued.length) {
        return
      }

      pendingIceRef.current.delete(peerId)

      for (const candidate of queued) {
        try {
          await peer.addIceCandidate(candidate)
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.log("ICE_FLUSH_ERROR", { peerId, error })
          }
        }
      }
    },
    []
  )

  const createPeerConnection = React.useCallback(
    (peerId: string, requestedMode?: PeerTransportMode) => {
      const existing = peersRef.current.get(peerId)
      if (existing) {
        return existing
      }

      const mode =
        requestedMode ??
        peerModeRef.current.get(peerId) ??
        (forceTurn ? "relay" : "p2p")
      peerModeRef.current.set(peerId, mode)

      const rtcConfig: RTCConfiguration =
        mode === "relay" && hasTurnServer
          ? {
              iceServers: turnServers,
              iceTransportPolicy: "relay",
            }
          : {
              iceServers: hasTurnServer
                ? [...p2pIceServers, ...turnServers]
                : p2pIceServers,
            }

      const connection = new RTCPeerConnection({
        ...rtcConfig,
      })

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          connection.addTrack(track, localStream)
        })
      }

      connection.onicecandidate = (event) => {
        if (!event.candidate || !playerId) {
          return
        }
        const candidate: RTCIceCandidateInit = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid ?? undefined,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? undefined,
          usernameFragment: event.candidate.usernameFragment ?? undefined,
        }
        const typeMatch = candidate.candidate?.match(/\btyp\s+([a-zA-Z]+)/)
        const candidateType = typeMatch?.[1]?.toLowerCase()
        if (candidateType) {
          const typeSet = iceTypesRef.current.get(peerId) ?? new Set<string>()
          typeSet.add(candidateType)
          iceTypesRef.current.set(peerId, typeSet)
          setIceStatus(`ICE candidates: ${Array.from(typeSet).join(", ")}`)
        }
        if (candidate.candidate?.includes(" typ relay ")) {
          relayCandidateSeenRef.current.set(peerId, true)
        }
        sendSignal({
          type: "ice",
          from: playerId,
          to: peerId,
          candidate,
        })
      }

      connection.ontrack = (event) => {
        const [stream] = event.streams
        if (!stream) {
          return
        }
        setRemoteStreams((current) => {
          if (current[peerId] === stream) {
            return current
          }
          return { ...current, [peerId]: stream }
        })

        const timeoutId = connectTimeoutsRef.current.get(peerId)
        if (timeoutId) {
          clearTimeout(timeoutId)
          connectTimeoutsRef.current.delete(peerId)
        }
      }

      connection.onconnectionstatechange = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("PEER_CONNECTION_STATE", {
            peerId,
            mode: peerModeRef.current.get(peerId) ?? mode,
            state: connection.connectionState,
          })
        }

        if (connection.connectionState === "closed") {
          cleanupPeer(peerId)
          return
        }

        if (connection.connectionState === "connected") {
          setWebrtcStatus("")
          const timeoutId = connectTimeoutsRef.current.get(peerId)
          if (timeoutId) {
            clearTimeout(timeoutId)
            connectTimeoutsRef.current.delete(peerId)
          }
          return
        }

        if (connection.connectionState !== "failed") {
          return
        }

        const currentMode = peerModeRef.current.get(peerId) ?? mode
        if (currentMode === "p2p" && hasTurnServer && playerId) {
          setWebrtcStatus("P2P failed. Switching to TURN relay...")
          cleanupPeer(peerId)
          peerModeRef.current.set(peerId, "relay")

          sendSignal({
            type: "ready",
            from: playerId,
            to: peerId,
            transport: "relay",
          })
          return
        }

        cleanupPeer(peerId)
      }

      connection.oniceconnectionstatechange = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("PEER_ICE_STATE", {
            peerId,
            mode: peerModeRef.current.get(peerId) ?? mode,
            state: connection.iceConnectionState,
          })
        }

        if (
          connection.iceConnectionState === "connected" ||
          connection.iceConnectionState === "completed"
        ) {
          const typeSet = iceTypesRef.current.get(peerId)
          if (typeSet?.size) {
            setIceStatus(`Connected via ICE: ${Array.from(typeSet).join(", ")}`)
          }
          const timeoutId = connectTimeoutsRef.current.get(peerId)
          if (timeoutId) {
            clearTimeout(timeoutId)
            connectTimeoutsRef.current.delete(peerId)
          }
        }
      }

      peersRef.current.set(peerId, connection)
      scheduleConnectTimeout(peerId, mode)
      return connection
    },
    [
      cleanupPeer,
      hasTurnServer,
      localStream,
      p2pIceServers,
      playerId,
      scheduleConnectTimeout,
      sendSignal,
      turnServers,
      forceTurn,
    ]
  )

  const sendOfferForPeer = React.useCallback(
    async (peerId: string, mode?: PeerTransportMode) => {
      if (!playerId) {
        return
      }

      const selectedMode = mode ?? peerModeRef.current.get(peerId) ?? "p2p"
      const peer = createPeerConnection(peerId, selectedMode)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)

      sendSignal({
        type: "offer",
        from: playerId,
        to: peerId,
        sdp: peer.localDescription ?? offer,
        transport: selectedMode,
      })
    },
    [createPeerConnection, playerId, sendSignal]
  )

  const isVirtual = state.lobby.mode === "VIRTUAL"
  const isActive = state.lobby.activePlayerId === playerId
  const keepAwakeEnabled = hasSeenTutorial && state.lobby.status === "IN_GAME"
  const wakeLock = useKeepScreenAwake(keepAwakeEnabled)
  const turnKey = `${state.lobby.currentTurnIndex}-${state.lobby.currentCardIndex}`
  // Tweak duration/urgent thresholds here.
  // Timer checklist: starts on card, urgent at 10s, expires once, manual Next cancels, resets on turn change.
  const turnTimer = useTurnTimer({
    durationSeconds: 30,
    urgentThresholdSeconds: 10,
    onExpire: () => handleNext(),
    autoStart: false,
    key: turnKey,
  })

  React.useEffect(() => {
    if (!localStream) {
      return
    }
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMicMuted
    })
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !isVideoMuted
    })
  }, [isMicMuted, isVideoMuted, localStream])

  React.useEffect(() => {
    if (!isVirtual || !playerId) {
      return
    }

    let cancelled = false
    let activeStream: MediaStream | null = null

    const requestMedia = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError("Camera and microphone are not supported.")
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        activeStream = stream
        setMediaError("")
        setLocalStream(stream)
      } catch {
        setMediaError("Unable to access camera or microphone.")
      }
    }

    requestMedia()

    return () => {
      cancelled = true
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop())
      }
      setLocalStream(null)
    }
  }, [isVirtual, playerId])

  React.useEffect(() => {
    if (!isVirtual || !playerId || !localStream) {
      return
    }
    if (typeof RTCPeerConnection === "undefined") {
      setMediaError("Video calling isn't supported in this browser.")
      return
    }

    const lobbyId = state.lobby.id
    const channel = supabaseBrowser
      .channel(`video-${lobbyId}`, {
        config: { broadcast: { self: true, ack: true } },
      })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        try {
          const message = payload as SignalPayload
          if (!message?.from || message.from === playerId) {
            return
          }
          if (message.to && message.to !== playerId) {
            return
          }

          if (message.type === "ready") {
            bumpSignalCount("readyReceived")
          } else if (message.type === "offer") {
            bumpSignalCount("offerReceived")
          } else if (message.type === "answer") {
            bumpSignalCount("answerReceived")
          } else if (message.type === "ice") {
            bumpSignalCount("iceReceived")
          }

          const transportMode: PeerTransportMode =
            message.transport === "relay" ? "relay" : "p2p"

          if (message.type === "ready") {
            peerModeRef.current.set(message.from, transportMode)

            const existingPeer = peersRef.current.get(message.from)
            if (
              existingPeer &&
              (existingPeer.connectionState === "connected" ||
                existingPeer.connectionState === "connecting")
            ) {
              return
            }

            if (playerId < message.from) {
              await sendOfferForPeer(message.from, transportMode)
            } else {
              // If this side is not the offerer, ping back so the lower-id peer
              // can initiate even when initial "ready" was missed on subscribe.
              sendSignal({
                type: "ready",
                from: playerId,
                to: message.from,
                transport: transportMode,
              })
            }
            return
          }

          if (message.type === "offer" && message.sdp) {
            peerModeRef.current.set(message.from, transportMode)
            const peer = createPeerConnection(message.from, transportMode)
            await peer.setRemoteDescription(message.sdp)
            await flushPendingIce(message.from, peer)
            const answer = await peer.createAnswer()
            await peer.setLocalDescription(answer)
            sendSignal({
              type: "answer",
              from: playerId,
              to: message.from,
              sdp: peer.localDescription ?? answer,
              transport: transportMode,
            })
            return
          }

          if (message.type === "answer" && message.sdp) {
            const peer = createPeerConnection(message.from)
            await peer.setRemoteDescription(message.sdp)
            await flushPendingIce(message.from, peer)
            return
          }

          if (message.type === "ice" && message.candidate) {
            const peer = createPeerConnection(message.from)

            if (!peer.remoteDescription) {
              const queued = pendingIceRef.current.get(message.from) ?? []
              queued.push(message.candidate)
              pendingIceRef.current.set(message.from, queued)
              return
            }

            await peer.addIceCandidate(message.candidate)
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.log("SIGNAL_HANDLE_ERROR", error)
          }
        }
      })

    channelRef.current = channel

    let readyHeartbeat: ReturnType<typeof setInterval> | null = null

    channel.subscribe((status) => {
      setSignalStatus(status)
      if (status === "SUBSCRIBED") {
        setWebrtcStatus("")
        channel.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ready",
            from: playerId,
            transport: forceTurn ? "relay" : "p2p",
          },
        })

        readyHeartbeat = setInterval(() => {
          channel.send({
            type: "broadcast",
            event: "signal",
            payload: {
              type: "ready",
              from: playerId,
              transport: forceTurn ? "relay" : "p2p",
            },
          })
        }, 7000)
        return
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setWebrtcStatus(`Signaling unavailable (${status}).`)
      }
    })

    return () => {
      if (readyHeartbeat) {
        clearInterval(readyHeartbeat)
      }
      channelRef.current = null
      supabaseBrowser.removeChannel(channel)
      peersRef.current.forEach((_, peerId) => cleanupPeer(peerId))
    }
  }, [
    flushPendingIce,
    bumpSignalCount,
    cleanupPeer,
    createPeerConnection,
    isVirtual,
    localStream,
    playerId,
    sendOfferForPeer,
    sendSignal,
    state.lobby.id,
  ])

  React.useEffect(() => {
    if (!isVirtual || !playerId || !localStream) {
      return
    }

    let cancelled = false

    const ensurePeerLinks = async () => {
      for (const player of state.players) {
        const peerId = player.id
        if (peerId === playerId) {
          continue
        }

        const peer = peersRef.current.get(peerId)
        if (
          peer &&
          (peer.connectionState === "connected" ||
            peer.connectionState === "connecting")
        ) {
          continue
        }

        const mode =
          peerModeRef.current.get(peerId) ?? (forceTurn ? "relay" : "p2p")

        if (playerId < peerId) {
          const now = Date.now()
          const lastAttempt = offerAttemptAtRef.current.get(peerId) ?? 0
          if (now - lastAttempt < 3000) {
            continue
          }
          offerAttemptAtRef.current.set(peerId, now)

          try {
            await sendOfferForPeer(peerId, mode)
          } catch (error) {
            if (process.env.NODE_ENV === "development") {
              console.log("ENSURE_PEER_OFFER_ERROR", { peerId, error })
            }
          }
        } else {
          sendSignal({
            type: "ready",
            from: playerId,
            to: peerId,
            transport: mode,
          })
        }
      }
    }

    void ensurePeerLinks()
    const intervalId = setInterval(() => {
      if (!cancelled) {
        void ensurePeerLinks()
      }
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [
    forceTurn,
    isVirtual,
    localStream,
    playerId,
    sendOfferForPeer,
    sendSignal,
    state.players,
  ])

  React.useEffect(() => {
    if (!isVirtual) {
      return
    }
    const activeIds = new Set(state.players.map((player) => player.id))
    Object.keys(remoteStreams).forEach((peerId) => {
      if (!activeIds.has(peerId)) {
        cleanupPeer(peerId)
      }
    })
  }, [cleanupPeer, isVirtual, remoteStreams, state.players])

  React.useEffect(() => {
    if (isVirtual) {
      return
    }
    if (!hasSeenTutorial) {
      return
    }

    if (!isActive) {
      setCountdown(null)
      setShowCard(false)
      return
    }

    if (lastTurnIndex !== state.lobby.currentTurnIndex) {
      setLastTurnIndex(state.lobby.currentTurnIndex)
      setShowCard(false)
      setCountdown(10)
    }
  }, [
    hasSeenTutorial,
    isActive,
    isVirtual,
    lastTurnIndex,
    state.lobby.currentTurnIndex,
  ])

  React.useEffect(() => {
    if (isVirtual) {
      return
    }
    if (countdown === null) {
      return
    }

    if (countdown <= 0) {
      setCountdown(null)
      setShowCard(true)
      return
    }

    const timer = window.setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [countdown, isVirtual])

  React.useEffect(() => {
    const lobbyId = initialState.lobby.id
    const channel = supabaseBrowser
      .channel(`game-${lobbyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Lobby", filter: `id=eq.${lobbyId}` },
        fetchState
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Player", filter: `lobbyId=eq.${lobbyId}` },
        fetchState
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Photo", filter: `lobbyId=eq.${lobbyId}` },
        fetchState
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [fetchState, initialState.lobby.id])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      fetchState()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [fetchState])

  const activePlayer = state.players.find(
    (player) => player.id === state.lobby.activePlayerId
  )

  const handleNext = async () => {
    if (isAdvancingRef.current) {
      return
    }
    if (!playerId) {
      setActionError("Missing player id.")
      return
    }

    isAdvancingRef.current = true
    turnTimer.pause()
    setIsSubmitting(true)
    setActionError("")

    try {
      const response = await fetch("/api/game/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyCode: state.lobby.code, playerId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setActionError(payload?.error ?? "Unable to advance turn.")
        return
      }
      await fetchState()
    } catch {
      setActionError("Unable to advance turn.")
    } finally {
      isAdvancingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleLeave = async () => {
    if (!playerId) {
      router.push("/")
      return
    }

    setIsSubmitting(true)
    setActionError("")

    try {
      const response = await fetch("/api/game/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyCode: state.lobby.code, playerId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setActionError(payload?.error ?? "Unable to leave game.")
        return
      }
      router.push("/")
    } catch {
      setActionError("Unable to leave game.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (state.lobby.status === "ENDED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide">
          Game Over
        </h1>
        <p className="text-sm text-black/70">Thanks for playing!</p>
        <SecondaryButton type="button" onClick={() => router.push("/")}
        >
          Back Home
        </SecondaryButton>
        <a
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-black/40 bg-offwhite/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-black/70 transition-colors hover:bg-offwhite"
        >
          Give Feedback / Report Bug
        </a>
        <AdSlot slot="RESULTS_BANNER" className="mt-6 flex justify-center" />
      </div>
    )
  }

  if (!hasSeenTutorial) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 pb-10 pt-8">
        <div className="w-full max-w-md">
          <header className="text-left">
            <h1 className="font-display text-3xl uppercase tracking-wide">
              How to Play
            </h1>
            <p className="mt-2 text-sm text-black/70">
              Quick rules before we start the round.
            </p>
          </header>

          <div className="mt-6 rounded-3xl border-2 border-black bg-offwhite p-6 shadow-[6px_6px_0_#000]">
            <div className="grid gap-4">
              <div className="flex items-start gap-3 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-primary shadow-[2px_2px_0_#000]">
                  <div className="h-6 w-3 rounded-sm border-2 border-black bg-offwhite -rotate-90" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Hold Phone Up (In Person)
                  </p>
                  <p className="text-sm text-black/80">
                    Active player holds the phone above their head.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-primary shadow-[2px_2px_0_#000]">
                  <div className="h-6 w-6 rounded-md border-2 border-black bg-offwhite" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Give Hints
                  </p>
                  <p className="text-sm text-black/80">
                    Teammates give clues without saying the title.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-primary shadow-[2px_2px_0_#000]">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-black">
                    Next
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Next Card
                  </p>
                  <p className="text-sm text-black/80">
                    Tap Next to advance to the next player and card.
                  </p>
                </div>
              </div>
            </div>

            <PrimaryButton
              className="mt-6 w-full"
              type="button"
              onClick={() => setHasSeenTutorial(true)}
            >
              I'm Ready
            </PrimaryButton>
          </div>
        </div>
      </div>
    )
  }

  if (state.lobby.status === "LOBBY") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide">
          Game Starting
        </h1>
        <p className="text-sm text-black/70">
          Hang tight while the host starts the game.
        </p>
        <div className="flex gap-2 text-lg font-bold">
          <span className="animate-pulse">.</span>
          <span className="animate-pulse [animation-delay:200ms]">.</span>
          <span className="animate-pulse [animation-delay:400ms]">.</span>
        </div>
        <SecondaryButton type="button" onClick={() => router.push("/")}>
          Back Home
        </SecondaryButton>
      </div>
    )
  }

  if (isVirtual) {
    const controlsDisabled = !localStream || Boolean(mediaError)
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-6 px-4 pb-10 pt-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl uppercase tracking-wide">
              Game Time
            </h1>
            <p className="text-sm text-black/70">
              Virtual (Video) · Code: {state.lobby.code}
            </p>
          </div>
          <SecondaryButton type="button" onClick={handleLeave}>
            Leave Game
          </SecondaryButton>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => setIsMicMuted((prev) => !prev)}
            className={`rounded-full border-2 border-black px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-[2px_2px_0_#000] ${
              isMicMuted ? "bg-primary text-black" : "bg-offwhite text-black"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isMicMuted ? "Unmute Mic" : "Mute Mic"}
          </button>
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() => setIsVideoMuted((prev) => !prev)}
            className={`rounded-full border-2 border-black px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-[2px_2px_0_#000] ${
              isVideoMuted ? "bg-primary text-black" : "bg-offwhite text-black"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
          </button>
        </div>

        {mediaError ? (
          <div className="rounded-2xl border-2 border-black bg-offwhite px-4 py-3 text-sm font-semibold text-black shadow-[3px_3px_0_#000]">
            {mediaError}
          </div>
        ) : null}
        <div className="rounded-2xl border-2 border-black bg-lightgray px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-black/70 shadow-[3px_3px_0_#000]">
          Signal: {signalStatus}
        </div>
        {webrtcStatus ? (
          <div className="rounded-2xl border-2 border-black bg-lightgray px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black/70 shadow-[3px_3px_0_#000]">
            {webrtcStatus}
          </div>
        ) : null}
        {signalDebug ? (
          <div className="rounded-2xl border-2 border-black bg-lightgray px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-black/70 shadow-[3px_3px_0_#000]">
            {signalDebug}
          </div>
        ) : null}
        {iceStatus ? (
          <div className="rounded-2xl border-2 border-black bg-lightgray px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-black/70 shadow-[3px_3px_0_#000]">
            {iceStatus}
          </div>
        ) : null}

        <div className="relative rounded-3xl border-2 border-black bg-offwhite p-4 shadow-[6px_6px_0_#000]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
              Live room
            </p>
          </div>

          {(() => {
            const activePlayer = state.players.find(
              (player) => player.id === state.lobby.activePlayerId
            )
            const activeId = activePlayer?.id
            const otherPlayers = state.players.filter(
              (player) => player.id !== activeId
            )
            const renderTile = (
              player: Player,
              size: "main" | "thumb" | "panel"
            ) => {
              const isSelf = player.id === playerId
              const isGuesser = player.id === state.lobby.activePlayerId
              const stream = isSelf
                ? localStream
                : remoteStreams[player.id] ?? null
              const showPlaceholder = isGuesser && isSelf
              const card = isGuesser && !isSelf ? state.photos.currentCard : null

              return (
                <div
                  key={player.id}
                  className={
                    size === "panel"
                      ? "h-full w-full"
                      : size === "main"
                        ? "aspect-[3/4] w-full"
                        : "aspect-[3/4] w-24 flex-shrink-0"
                  }
                >
                  <VideoTile
                    stream={stream}
                    name={player.name}
                    isActive={isGuesser}
                    isSelf={isSelf}
                    showPlaceholder={showPlaceholder}
                    card={card}
                  />
                </div>
              )
            }

            return (
              <div className="mt-4">
                <div className="flex flex-col gap-3 md:hidden">
                  {activePlayer ? (
                    <div className="w-full">
                      {renderTile(activePlayer, "main")}
                    </div>
                  ) : null}
                  {otherPlayers.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {otherPlayers.map((player) => renderTile(player, "thumb"))}
                    </div>
                  ) : null}
                </div>
                <div className="hidden md:flex h-[min(72vh,760px)] min-h-[520px] items-stretch gap-4">
                  <div className="h-full w-1/2">
                    {activePlayer ? renderTile(activePlayer, "panel") : null}
                  </div>
                  <div className="h-full w-1/2">
                    {otherPlayers.length > 0 ? (
                      <div className="grid h-full min-h-0 grid-cols-2 auto-rows-fr gap-3">
                        {otherPlayers.map((player) =>
                          renderTile(player, "panel")
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })()}
          {isActive ? (
            <div className="absolute bottom-4 right-4 z-10">
              <PrimaryButton
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="px-5 py-2 text-sm"
              >
                {isSubmitting ? "Advancing..." : "Next"}
              </PrimaryButton>
            </div>
          ) : null}
        </div>

        {!isActive ? (
          <div className="rounded-2xl border-2 border-black bg-offwhite px-4 py-3 text-sm text-black/70 shadow-[3px_3px_0_#000]">
            Give hints without saying the title.
          </div>
        ) : null}

        {actionError ? (
          <p className="text-sm font-semibold text-black">{actionError}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 px-4 pb-10 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Game Time
          </h1>
          <p className="text-sm text-black/70">Code: {state.lobby.code}</p>
        </div>
        <SecondaryButton type="button" onClick={handleLeave}>
          Leave Game
        </SecondaryButton>
      </header>

      {isActive ? (
        <div className="flex flex-1 flex-col gap-4">
          {countdown !== null ? (
            <div
              className="fixed inset-0 z-20 h-[100dvh] w-[100dvw] touch-none overflow-hidden overscroll-none"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(180deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                backgroundColor: "var(--offwhite)",
              }}
            >
              {/* CSS-only rotation to simulate landscape without sensors. */}
              <div
                className="absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 rotate-90"
                style={{ width: "100dvh", height: "100dvw" }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center text-black">
                  <p className="text-sm font-semibold uppercase tracking-wide text-black">
                    Your turn
                  </p>
                  <h2 className="font-display text-2xl uppercase tracking-wide text-black">
                    Rotate phone to landscape and hold above your head
                  </h2>
                  <div className="mt-4 text-6xl font-bold text-black">
                    {countdown}
                  </div>
                  {keepAwakeEnabled && (!wakeLock.isSupported || wakeLock.hadError) ? (
                    <div className="mt-4 rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-xs text-black/70 shadow-[2px_2px_0_#000]">
                      <p>
                        Tip: Turn Low Power Mode off / keep your screen active in
                        your phone settings.
                      </p>
                      {!wakeLock.isActive ? (
                        <button
                          type="button"
                          className="mt-2 rounded-full border-2 border-black bg-primary px-3 py-1 text-xs font-semibold text-black shadow-[2px_2px_0_#000]"
                          onClick={() => wakeLock.requestWakeLock()}
                        >
                          Keep screen on
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : showCard && state.photos.currentCard ? (
            <div
              className="fixed inset-0 z-20 h-[100dvh] w-[100dvw] touch-none overflow-hidden overscroll-none"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(180deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                backgroundColor: "var(--offwhite)",
              }}
            >
              {/* CSS-only rotation to simulate landscape without sensors. */}
              <div
                className="absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 rotate-90"
                style={{ width: "100dvh", height: "100dvw" }}
              >
                <div className="relative flex h-full w-full flex-col gap-3 px-4 py-4">
                  <div className="flex min-h-0 flex-1 items-center justify-center gap-3 pt-8">
                    <div className="flex h-full w-16 items-center justify-center">
                      <SecondaryButton
                        type="button"
                        onClick={handleLeave}
                        className="w-full"
                      >
                        Leave
                      </SecondaryButton>
                    </div>
                    <div className="flex min-h-0 w-[72%] items-center justify-center rounded-3xl border-2 border-black bg-lightgray/60 p-3 shadow-[6px_6px_0_#000]">
                      <img
                        src={state.photos.currentCard.publicUrl}
                        alt={state.photos.currentCard.title}
                        className="max-h-[68dvw] w-full object-contain"
                      />
                    </div>
                    <div className="flex h-full w-16 items-center justify-center">
                      <PrimaryButton
                        type="button"
                        onClick={handleNext}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? "Advancing..." : "Next"}
                      </PrimaryButton>
                    </div>
                  </div>
                  {state.photos.currentCard.title ? (
                    <div className="mx-auto w-full max-w-[90%] rounded-2xl border-2 border-black bg-offwhite px-4 py-2 text-center shadow-[4px_4px_0_#000]">
                      <h2 className="font-display text-xl uppercase leading-tight tracking-wide text-black sm:text-2xl">
                        {state.photos.currentCard.title}
                      </h2>
                    </div>
                  ) : null}
                  {keepAwakeEnabled && (!wakeLock.isSupported || wakeLock.hadError) ? (
                    <div className="mx-auto w-full max-w-[90%] rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-center text-xs text-black/70 shadow-[2px_2px_0_#000]">
                      <p>
                        Tip: Turn Low Power Mode off / keep your screen active in
                        your phone settings.
                      </p>
                      {!wakeLock.isActive ? (
                        <button
                          type="button"
                          className="mt-2 rounded-full border-2 border-black bg-primary px-3 py-1 text-xs font-semibold text-black shadow-[2px_2px_0_#000]"
                          onClick={() => wakeLock.requestWakeLock()}
                        >
                          Keep screen on
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {actionError ? (
                    <p className="text-center text-sm font-semibold text-black">
                      {actionError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-black bg-offwhite p-6 shadow-[6px_6px_0_#000]">
              <h2 className="font-display text-2xl uppercase tracking-wide">
                No cards left
              </h2>
              <p className="text-sm text-black/70">
                Tap Next to wrap up.
              </p>
              <PrimaryButton
                className="mt-4 w-full"
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Finishing..." : "Next"}
              </PrimaryButton>
              {actionError ? (
                <p className="text-sm font-semibold text-black">{actionError}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-black bg-offwhite p-6 text-center shadow-[6px_6px_0_#000]">
          <p className="text-sm font-semibold uppercase tracking-wide">
            Give hints
          </p>
          <h2 className="font-display text-2xl uppercase tracking-wide">
            {activePlayer ? `${activePlayer.name}'s turn` : "Waiting"}
          </h2>
          <p className="text-sm text-black/70">
            Give hints without saying the title. The guesser can ask questions.
          </p>
          <div className="flex gap-2 text-lg font-bold">
            <span className="animate-pulse">.</span>
            <span className="animate-pulse [animation-delay:200ms]">.</span>
            <span className="animate-pulse [animation-delay:400ms]">.</span>
          </div>
          {keepAwakeEnabled && (!wakeLock.isSupported || wakeLock.hadError) ? (
            <div className="mt-2 rounded-xl border-2 border-black bg-lightgray px-3 py-2 text-xs text-black/70 shadow-[2px_2px_0_#000]">
              <p>
                Tip: Turn Low Power Mode off / keep your screen active in your
                phone settings.
              </p>
              {!wakeLock.isActive ? (
                <button
                  type="button"
                  className="mt-2 rounded-full border-2 border-black bg-primary px-3 py-1 text-xs font-semibold text-black shadow-[2px_2px_0_#000]"
                  onClick={() => wakeLock.requestWakeLock()}
                >
                  Keep screen on
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export { GameScreen }

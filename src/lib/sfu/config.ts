// DecksUp SFU migration context metadata:
// Date: 2026-02-19
// Region: America/Toronto

export const SFU_CONFIG = {
  metadata: {
    generatedAt: "2026-02-19",
    region: "America/Toronto",
    product: "DecksUp",
  },
  signaling: {
    wsPath: "/api/signaling/ws",
    turnTokenPath: "/api/turn-token",
    telemetryPath: "/api/telemetry",
  },
  ice: {
    stunOnlyServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
    ] as RTCIceServer[],
    relayTokenTtlSeconds: 600, // 10 minutes; short-lived credentials.
  },
  relay: {
    requestTimeoutMs: 20_000,
    maxRelayParticipants: 6,
    sessionMaxDurationMinutes: 120,
    enforceAudioOnlyOnDenied: true,
  },
  quality: {
    simulcast: {
      low: {
        rid: "low",
        scaleResolutionDownBy: 2.67,
        maxBitrate: 150_000,
        maxFramerate: 15,
      },
      medium: {
        rid: "med",
        scaleResolutionDownBy: 1.34,
        maxBitrate: 400_000,
        maxFramerate: 20,
      },
      high: {
        rid: "high",
        scaleResolutionDownBy: 1,
        maxBitrate: 800_000,
        maxFramerate: 24,
      },
    },
    profiles: {
      normal: {
        width: 640,
        height: 480,
        frameRate: 24,
        maxBitrate: 600_000,
      },
      relay: {
        width: 640,
        height: 360,
        frameRate: 15,
        maxBitrate: 300_000,
      },
    },
    relayDetectPollMs: 3_000,
  },
  credits: {
    baseRateCreditsPerParticipantMinute: 1,
    tickMs: 60_000,
    monthlyGrantMinutes: 300,
    bankMonthsCap: 3,
    standardPriceCents: 999,
    discountedPriceCents: 799,
    overageRatePerMinuteCredits: 2,
    allowPayAsYouGoOverage: false,
  },
} as const

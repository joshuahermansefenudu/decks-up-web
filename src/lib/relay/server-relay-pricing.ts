import { Prisma, type PlanType, type RelaySessionStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE =
  Number.parseFloat(process.env.RELAY_BASE_RATE_PER_MINUTE ?? "0.2") || 0.2
export const RELAY_MAX_PARTICIPANTS = Number.parseInt(
  process.env.RELAY_MAX_VIDEO_PARTICIPANTS ?? "6",
  10
)
const RELAY_TICK_COOLDOWN_MS = 50_000
const RELAY_SESSION_MAX_MINUTES = 120
const RENEWAL_CYCLE_DAYS = 30
const BANK_EXPIRY_DAYS = 90

type RelayDbClient = Prisma.TransactionClient | typeof prisma

type PlanRule = {
  monthlyHours: number
  bankCapHours: number
  standardPriceUsd: number
  loyaltyPriceUsd: number
  overageRatePerMinute: number
}

export type RelayProfileSummary = {
  userId: string
  planType: PlanType
  monthlyHours: number
  bankedHours: number
  bankExpiryDate: string | null
  loyaltyActive: boolean
  totalAvailableHours: number
  renewalPriceUsd: number
  standardPriceUsd: number
  loyaltyPriceUsd: number
  lowCreditWarning: boolean
  expiringHoursWithin7Days: number
  expiringInDays: number | null
}

export type RelayRoomState = {
  relayEnabled: boolean
  relayStatus: RelaySessionStatus | "NONE"
  activeVideoParticipants: number
  burnRatePerMinute: number
  remainingHostHours: number
  hostPlanType: PlanType
  relayDisabledReason: string | null
  maxRelayParticipants: number
  activeRequesterPlayerId: string | null
  pendingRequest: {
    requestId: string
    requesterPlayerId: string
    requesterName: string
    estimatedBurnRatePerMinute: number
  } | null
}

const PLAN_RULES: Record<PlanType, PlanRule> = {
  FREE: {
    monthlyHours: 0,
    bankCapHours: 0,
    standardPriceUsd: 0,
    loyaltyPriceUsd: 0,
    overageRatePerMinute: 0.35,
  },
  CORE: {
    monthlyHours: 5,
    bankCapHours: 15,
    standardPriceUsd: 6.99,
    loyaltyPriceUsd: 4.99,
    overageRatePerMinute: 0.3,
  },
  PRO: {
    monthlyHours: 12,
    bankCapHours: 36,
    standardPriceUsd: 11.99,
    loyaltyPriceUsd: 8.99,
    overageRatePerMinute: 0.2,
  },
}

const CREDIT_PACK_HOURS = {
  STARTER: 3,
  STANDARD: 7,
  PARTY: 15,
} as const

type CreditPackType = keyof typeof CREDIT_PACK_HOURS

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function roundHours(value: number) {
  return Math.max(0, Number(value.toFixed(4)))
}

function planRule(planType: PlanType): PlanRule {
  return PLAN_RULES[planType] ?? PLAN_RULES.FREE
}

async function ensureProfile(userId: string, db: RelayDbClient) {
  const existing = await db.userRelayProfile.findUnique({ where: { userId } })
  if (existing) {
    return existing
  }

  const defaults = planRule("FREE")
  return db.userRelayProfile.create({
    data: {
      userId,
      planType: "FREE",
      monthlyHours: defaults.monthlyHours,
      bankedHours: 0,
      loyaltyActive: false,
      lastRenewalDate: new Date(),
    },
  })
}

async function pruneExpiredBuckets(userId: string, now: Date, db: RelayDbClient) {
  await db.relayHourBucket.deleteMany({
    where: {
      userId,
      OR: [{ remainingHours: { lte: 0 } }, { expiresAt: { lt: now } }],
    },
  })
}

async function getBuckets(userId: string, now: Date, db: RelayDbClient) {
  return db.relayHourBucket.findMany({
    where: {
      userId,
      remainingHours: { gt: 0 },
      expiresAt: { gte: now },
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  })
}

async function trimMonthlyBucketsToCap(
  userId: string,
  capHours: number,
  now: Date,
  db: RelayDbClient
) {
  const monthlyBuckets = await db.relayHourBucket.findMany({
    where: {
      userId,
      source: "MONTHLY_GRANT",
      remainingHours: { gt: 0 },
      expiresAt: { gte: now },
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  })

  const total = monthlyBuckets.reduce(
    (sum, bucket) => sum + bucket.remainingHours,
    0
  )
  let overflow = roundHours(total - capHours)
  if (overflow <= 0) {
    return
  }

  for (const bucket of monthlyBuckets) {
    if (overflow <= 0) {
      break
    }
    const nextRemaining = roundHours(bucket.remainingHours - overflow)
    const deduction = bucket.remainingHours - nextRemaining
    overflow = roundHours(overflow - deduction)

    if (nextRemaining <= 0) {
      await db.relayHourBucket.delete({ where: { id: bucket.id } })
    } else {
      await db.relayHourBucket.update({
        where: { id: bucket.id },
        data: { remainingHours: nextRemaining },
      })
    }
  }
}

async function recomputeProfileSummary(
  userId: string,
  now: Date,
  db: RelayDbClient
): Promise<RelayProfileSummary> {
  const profile = await ensureProfile(userId, db)
  const rules = planRule(profile.planType)
  await trimMonthlyBucketsToCap(userId, rules.bankCapHours, now, db)
  const buckets = await getBuckets(userId, now, db)

  const monthlyBuckets = buckets.filter((bucket) => bucket.source === "MONTHLY_GRANT")
  const bankedHours = roundHours(
    monthlyBuckets.reduce((sum, bucket) => sum + bucket.remainingHours, 0)
  )
  const totalAvailableHours = roundHours(
    buckets.reduce((sum, bucket) => sum + bucket.remainingHours, 0)
  )
  const earliestBankExpiry =
    monthlyBuckets.length > 0
      ? monthlyBuckets
          .map((bucket) => bucket.expiresAt)
          .sort((a, b) => a.getTime() - b.getTime())[0]
      : null

  const warningThreshold = Math.max(profile.monthlyHours * 0.2, 1)
  const lowCreditWarning = totalAvailableHours > 0 && totalAvailableHours <= warningThreshold
  const expiringCutoff = addDays(now, 7)
  const expiringBuckets = monthlyBuckets.filter(
    (bucket) => bucket.expiresAt <= expiringCutoff
  )
  const expiringHoursWithin7Days = roundHours(
    expiringBuckets.reduce((sum, bucket) => sum + bucket.remainingHours, 0)
  )
  const expiringInDays = expiringBuckets.length
    ? Math.max(
        0,
        Math.ceil(
          (expiringBuckets[0].expiresAt.getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : null

  const loyaltyActive = bankedHours > 0
  const renewalPriceUsd = loyaltyActive ? rules.loyaltyPriceUsd : rules.standardPriceUsd

  const updatedProfile = await db.userRelayProfile.update({
    where: { userId },
    data: {
      monthlyHours: rules.monthlyHours,
      bankedHours,
      bankExpiryDate: earliestBankExpiry,
      loyaltyActive,
    },
  })

  return {
    userId,
    planType: updatedProfile.planType,
    monthlyHours: updatedProfile.monthlyHours,
    bankedHours: updatedProfile.bankedHours,
    bankExpiryDate: updatedProfile.bankExpiryDate?.toISOString() ?? null,
    loyaltyActive: updatedProfile.loyaltyActive,
    totalAvailableHours,
    renewalPriceUsd,
    standardPriceUsd: rules.standardPriceUsd,
    loyaltyPriceUsd: rules.loyaltyPriceUsd,
    lowCreditWarning,
    expiringHoursWithin7Days,
    expiringInDays,
  }
}

async function runRenewalIfDue(userId: string, now: Date, db: RelayDbClient) {
  const profile = await ensureProfile(userId, db)
  const rules = planRule(profile.planType)
  if (rules.monthlyHours <= 0) {
    return
  }

  let renewalCursor = profile.lastRenewalDate
  let cycles = 0

  while (addDays(renewalCursor, RENEWAL_CYCLE_DAYS) <= now) {
    cycles += 1
    renewalCursor = addDays(renewalCursor, RENEWAL_CYCLE_DAYS)
    await pruneExpiredBuckets(userId, renewalCursor, db)
    await db.relayHourBucket.create({
      data: {
        userId,
        source: "MONTHLY_GRANT",
        totalHours: rules.monthlyHours,
        remainingHours: rules.monthlyHours,
        expiresAt: addDays(renewalCursor, BANK_EXPIRY_DAYS),
      },
    })
    await trimMonthlyBucketsToCap(userId, rules.bankCapHours, renewalCursor, db)
  }

  if (cycles > 0) {
    await db.userRelayProfile.update({
      where: { userId },
      data: {
        lastRenewalDate: renewalCursor,
      },
    })
  }
}

async function consumeHoursOldestFirst(
  userId: string,
  amountHours: number,
  now: Date,
  db: RelayDbClient
) {
  let remaining = roundHours(amountHours)
  if (remaining <= 0) {
    return { consumed: 0, leftover: 0 }
  }

  const buckets = await getBuckets(userId, now, db)
  let consumed = 0

  for (const bucket of buckets) {
    if (remaining <= 0) {
      break
    }

    const deducted = Math.min(bucket.remainingHours, remaining)
    const nextRemaining = roundHours(bucket.remainingHours - deducted)
    remaining = roundHours(remaining - deducted)
    consumed = roundHours(consumed + deducted)

    if (nextRemaining <= 0) {
      await db.relayHourBucket.delete({ where: { id: bucket.id } })
    } else {
      await db.relayHourBucket.update({
        where: { id: bucket.id },
        data: { remainingHours: nextRemaining },
      })
    }
  }

  return { consumed, leftover: remaining }
}

export async function getRelayProfile(userId: string) {
  return prisma.$transaction(async (tx) => {
    const now = new Date()
    await ensureProfile(userId, tx)
    await pruneExpiredBuckets(userId, now, tx)
    await runRenewalIfDue(userId, now, tx)
    return recomputeProfileSummary(userId, now, tx)
  })
}

export async function setRelayPlan(userId: string, nextPlan: PlanType) {
  return prisma.$transaction(async (tx) => {
    const now = new Date()
    const rules = planRule(nextPlan)
    await ensureProfile(userId, tx)
    await tx.userRelayProfile.update({
      where: { userId },
      data: {
        planType: nextPlan,
        monthlyHours: rules.monthlyHours,
      },
    })
    await pruneExpiredBuckets(userId, now, tx)
    return recomputeProfileSummary(userId, now, tx)
  })
}

export async function grantCreditPack(userId: string, pack: CreditPackType) {
  return prisma.$transaction(async (tx) => {
    const now = new Date()
    const hours = CREDIT_PACK_HOURS[pack]
    if (!hours) {
      throw new Error("invalid_credit_pack")
    }

    await ensureProfile(userId, tx)
    await tx.relayHourBucket.create({
      data: {
        userId,
        source: "CREDIT_PACK",
        totalHours: hours,
        remainingHours: hours,
        expiresAt: addDays(now, BANK_EXPIRY_DAYS),
      },
    })

    await pruneExpiredBuckets(userId, now, tx)
    return recomputeProfileSummary(userId, now, tx)
  })
}

export async function getPlayerPlanMap(
  authUserIds: string[]
): Promise<Record<string, PlanType>> {
  const ids = authUserIds.filter(Boolean)
  if (!ids.length) {
    return {}
  }

  try {
    const profiles = await prisma.userRelayProfile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, planType: true },
    })

    return profiles.reduce<Record<string, PlanType>>((acc, profile) => {
      acc[profile.userId] = profile.planType
      return acc
    }, {})
  } catch {
    // Failsafe for environments that have not run relay-pricing migration yet.
    return {}
  }
}

export async function requestRelayAccess(input: {
  lobbyCode: string
  requesterPlayerId: string
}) {
  return prisma.$transaction(async (tx) => {
    const code = input.lobbyCode.trim().toUpperCase()
    const requesterPlayerId = input.requesterPlayerId.trim()
    if (!code || !requesterPlayerId) {
      throw new Error("invalid_request")
    }

    const lobby = await tx.lobby.findUnique({
      where: { code },
      select: {
        id: true,
        status: true,
        mode: true,
        hostPlayerId: true,
      },
    })

    if (!lobby) {
      throw new Error("not_found")
    }
    if (lobby.mode !== "VIRTUAL") {
      throw new Error("relay_only_virtual")
    }
    if (lobby.status !== "IN_GAME") {
      throw new Error("not_in_game")
    }

    const requester = await tx.player.findUnique({
      where: { id: requesterPlayerId },
      select: { id: true, lobbyId: true, authUserId: true, leftAt: true, name: true },
    })

    if (!requester || requester.lobbyId !== lobby.id || requester.leftAt) {
      throw new Error("requester_not_active")
    }

    const host = lobby.hostPlayerId
      ? await tx.player.findUnique({
          where: { id: lobby.hostPlayerId },
          select: { id: true, authUserId: true, leftAt: true },
        })
      : null

    if (!host || host.leftAt) {
      throw new Error("host_unavailable")
    }
    if (!host.authUserId) {
      throw new Error("host_not_subscribed")
    }

    const openExisting = await tx.relaySession.findFirst({
      where: {
        lobbyId: lobby.id,
        requesterPlayerId: requester.id,
        status: { in: ["PENDING", "APPROVED", "ACTIVE"] },
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })
    if (openExisting) {
      return {
        requestId: openExisting.id,
        status: openExisting.status,
      }
    }

    const activeForLobby = await tx.relaySession.findFirst({
      where: {
        lobbyId: lobby.id,
        status: { in: ["APPROVED", "ACTIVE"] },
        expiresAt: { gte: new Date() },
      },
      select: { id: true },
    })
    if (activeForLobby) {
      throw new Error("relay_busy")
    }

    const created = await tx.relaySession.create({
      data: {
        lobbyId: lobby.id,
        requesterPlayerId: requester.id,
        requesterUserId: requester.authUserId,
        hostPlayerId: host.id,
        hostUserId: host.authUserId,
        status: "PENDING",
        maxMinutesGranted: 30,
        expiresAt: addDays(new Date(), 1),
        baseRate: RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE,
      },
      select: { id: true, status: true },
    })

    return {
      requestId: created.id,
      status: created.status,
    }
  })
}

export async function decideRelayRequest(input: {
  requestId: string
  hostPlayerId: string
  approved: boolean
  maxMinutesGranted?: number
}) {
  return prisma.$transaction(async (tx) => {
    const requestId = input.requestId.trim()
    const hostPlayerId = input.hostPlayerId.trim()
    if (!requestId || !hostPlayerId) {
      throw new Error("invalid_request")
    }

    const relayRequest = await tx.relaySession.findUnique({
      where: { id: requestId },
    })
    if (!relayRequest) {
      throw new Error("request_not_found")
    }
    if (relayRequest.status !== "PENDING") {
      throw new Error("request_already_handled")
    }

    if (!relayRequest.hostPlayerId || relayRequest.hostPlayerId !== hostPlayerId) {
      throw new Error("forbidden")
    }

    if (input.approved) {
      const host = relayRequest.hostUserId
        ? await getRelayProfile(relayRequest.hostUserId)
        : null
      if (!host || host.totalAvailableHours <= 0) {
        throw new Error("host_no_credits")
      }

      const activeForLobby = await tx.relaySession.findFirst({
        where: {
          lobbyId: relayRequest.lobbyId,
          status: { in: ["APPROVED", "ACTIVE"] },
          expiresAt: { gte: new Date() },
        },
        select: { id: true },
      })
      if (activeForLobby) {
        throw new Error("relay_busy")
      }
    }

    const updated = await tx.relaySession.update({
      where: { id: relayRequest.id },
      data: {
        status: input.approved ? "APPROVED" : "DENIED",
        note: input.approved ? "approved_by_host" : "denied_by_host",
        maxMinutesGranted: input.maxMinutesGranted
          ? Math.max(5, Math.min(120, Math.floor(input.maxMinutesGranted)))
          : relayRequest.maxMinutesGranted ?? 30,
      },
      select: {
        id: true,
        status: true,
        maxMinutesGranted: true,
      },
    })

    return updated
  })
}

export async function getRelayState(input: {
  lobbyCode: string
  playerId: string
}) {
  const code = input.lobbyCode.trim().toUpperCase()
  const playerId = input.playerId.trim()
  if (!code || !playerId) {
    throw new Error("invalid_request")
  }

  const lobby = await prisma.lobby.findUnique({
    where: { code },
    select: { id: true, hostPlayerId: true, mode: true, status: true },
  })
  if (!lobby) {
    throw new Error("not_found")
  }

  const players = await prisma.player.findMany({
    where: { lobbyId: lobby.id, leftAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, authUserId: true, isHost: true },
  })
  const selfPlayer = players.find((player) => player.id === playerId)
  if (!selfPlayer) {
    throw new Error("player_not_found")
  }

  const hostPlayer = players.find((player) => player.id === lobby.hostPlayerId)
  const hostUserId = hostPlayer?.authUserId ?? null
  const activeVideoParticipants = Math.min(players.length, RELAY_MAX_PARTICIPANTS)
  const burnRatePerMinute = roundHours(
    activeVideoParticipants * RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE
  )

  const hostSummary = hostUserId ? await getRelayProfile(hostUserId) : null
  const selfSummary = selfPlayer.authUserId
    ? await getRelayProfile(selfPlayer.authUserId)
    : null

  const activeSession = await prisma.relaySession.findFirst({
    where: {
      lobbyId: lobby.id,
      status: { in: ["APPROVED", "ACTIVE"] },
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      requesterPlayerId: true,
      maxMinutesGranted: true,
      startedAt: true,
      note: true,
    },
  })

  const pendingSession = await prisma.relaySession.findFirst({
    where: {
      lobbyId: lobby.id,
      status: "PENDING",
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      requesterPlayerId: true,
    },
  })

  const pendingRequester = pendingSession
    ? players.find((player) => player.id === pendingSession.requesterPlayerId)
    : null

  const canEnableRelaySelf = Boolean(
    selfSummary && selfSummary.totalAvailableHours > 0
  )

  const hostHasCredits = Boolean(hostSummary && hostSummary.totalAvailableHours > 0)
  const canRequestRelayFromHost =
    !canEnableRelaySelf &&
    Boolean(hostUserId) &&
    hostHasCredits &&
    lobby.mode === "VIRTUAL" &&
    lobby.status === "IN_GAME"

  const relayDisabledReason =
    !hostHasCredits && !canEnableRelaySelf
      ? "no_credits"
      : lobby.mode !== "VIRTUAL"
        ? "relay_only_virtual"
        : null

  return {
    room: {
      relayEnabled: Boolean(activeSession),
      relayStatus: activeSession?.status ?? "NONE",
      activeVideoParticipants,
      burnRatePerMinute,
      remainingHostHours: hostSummary?.totalAvailableHours ?? 0,
      hostPlanType: hostSummary?.planType ?? "FREE",
      relayDisabledReason,
      maxRelayParticipants: RELAY_MAX_PARTICIPANTS,
      activeRequesterPlayerId: activeSession?.requesterPlayerId ?? null,
      pendingRequest:
        pendingSession && pendingRequester
          ? {
              requestId: pendingSession.id,
              requesterPlayerId: pendingSession.requesterPlayerId,
              requesterName: pendingRequester.name,
              estimatedBurnRatePerMinute: burnRatePerMinute,
            }
          : null,
    },
    viewer: {
      planType: selfSummary?.planType ?? "FREE",
      canEnableRelay: canEnableRelaySelf,
      canRequestRelay: canRequestRelayFromHost,
      totalAvailableHours: selfSummary?.totalAvailableHours ?? 0,
      lowCreditWarning: Boolean(selfSummary?.lowCreditWarning),
      expiringSoonWarning: Boolean(selfSummary?.expiringHoursWithin7Days),
      expiringHoursWithin7Days: selfSummary?.expiringHoursWithin7Days ?? 0,
      expiringInDays: selfSummary?.expiringInDays ?? null,
    },
  }
}

export async function activateRelaySession(input: {
  lobbyCode: string
  playerId: string
}) {
  return prisma.$transaction(async (tx) => {
    const code = input.lobbyCode.trim().toUpperCase()
    const playerId = input.playerId.trim()
    if (!code || !playerId) {
      throw new Error("invalid_request")
    }

    const lobby = await tx.lobby.findUnique({
      where: { code },
      select: { id: true },
    })
    if (!lobby) {
      throw new Error("not_found")
    }

    const requester = await tx.player.findUnique({
      where: { id: playerId },
      select: { id: true, lobbyId: true, authUserId: true },
    })
    if (!requester || requester.lobbyId !== lobby.id) {
      throw new Error("requester_not_found")
    }

    const approvedSession = await tx.relaySession.findFirst({
      where: {
        lobbyId: lobby.id,
        requesterPlayerId: requester.id,
        status: "APPROVED",
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!approvedSession) {
      if (requester.authUserId) {
        const selfSummary = await getRelayProfile(requester.authUserId)
        if (selfSummary.totalAvailableHours > 0) {
          return {
            mode: "SELF",
            hostUserId: requester.authUserId,
            sessionId: null,
          }
        }
      }
      throw new Error("relay_not_approved")
    }

    const updated = await tx.relaySession.update({
      where: { id: approvedSession.id },
      data: {
        status: "ACTIVE",
        startedAt: approvedSession.startedAt ?? new Date(),
      },
      select: { id: true, hostUserId: true },
    })

    return {
      mode: "HOST",
      hostUserId: updated.hostUserId,
      sessionId: updated.id,
    }
  })
}

export async function deductRelayTick(input: {
  lobbyCode: string
  playerId: string
  activeVideoParticipants: number
}) {
  return prisma.$transaction(async (tx) => {
    const code = input.lobbyCode.trim().toUpperCase()
    const playerId = input.playerId.trim()
    if (!code || !playerId) {
      throw new Error("invalid_request")
    }

    const lobby = await tx.lobby.findUnique({
      where: { code },
      select: { id: true },
    })
    if (!lobby) {
      throw new Error("not_found")
    }

    const session = await tx.relaySession.findFirst({
      where: {
        lobbyId: lobby.id,
        requesterPlayerId: playerId,
        status: { in: ["APPROVED", "ACTIVE"] },
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })
    if (!session) {
      throw new Error("no_active_session")
    }

    const now = new Date()
    const startedAt = session.startedAt ?? session.createdAt
    const elapsedMinutes = (now.getTime() - startedAt.getTime()) / 60_000
    const grantedMaxMinutes = Math.max(
      1,
      Math.min(session.maxMinutesGranted ?? RELAY_SESSION_MAX_MINUTES, RELAY_SESSION_MAX_MINUTES)
    )
    if (elapsedMinutes >= grantedMaxMinutes) {
      await tx.relaySession.update({
        where: { id: session.id },
        data: {
          status: "ENDED",
          endedAt: now,
          note: "relay_duration_limit_reached",
        },
      })
      const hostSummary = session.hostUserId
        ? await getRelayProfile(session.hostUserId)
        : null
      return {
        deductedHours: 0,
        remainingHostHours: hostSummary?.totalAvailableHours ?? 0,
        relayEnabled: false,
        status: "ENDED" as const,
      }
    }

    if (
      session.lastDeductedAt &&
      now.getTime() - session.lastDeductedAt.getTime() < RELAY_TICK_COOLDOWN_MS
    ) {
      const hostSummary = session.hostUserId
        ? await getRelayProfile(session.hostUserId)
        : null
      return {
        deductedHours: 0,
        remainingHostHours: hostSummary?.totalAvailableHours ?? 0,
        relayEnabled: session.status !== "ENDED",
        status: session.status,
      }
    }

    const participants = Math.max(
      1,
      Math.min(input.activeVideoParticipants, RELAY_MAX_PARTICIPANTS)
    )
    const amount = roundHours(participants * session.baseRate)

    if (!session.hostUserId) {
      await tx.relaySession.update({
        where: { id: session.id },
        data: {
          status: "ENDED",
          endedAt: now,
          note: "host_missing",
        },
      })
      return {
        deductedHours: 0,
        remainingHostHours: 0,
        relayEnabled: false,
        status: "ENDED" as const,
      }
    }

    await pruneExpiredBuckets(session.hostUserId, now, tx)
    await runRenewalIfDue(session.hostUserId, now, tx)
    const deducted = await consumeHoursOldestFirst(session.hostUserId, amount, now, tx)
    const hostSummary = await recomputeProfileSummary(session.hostUserId, now, tx)

    const shouldDisable =
      deducted.leftover > 0 || hostSummary.totalAvailableHours <= 0 || participants > RELAY_MAX_PARTICIPANTS

    const updated = await tx.relaySession.update({
      where: { id: session.id },
      data: {
        status: shouldDisable ? "ENDED" : "ACTIVE",
        endedAt: shouldDisable ? now : null,
        activeVideoParticipants: participants,
        lastDeductedAt: now,
        note: shouldDisable ? "credits_exhausted_or_cap_reached" : "relay_tick",
      },
      select: { status: true },
    })

    return {
      deductedHours: deducted.consumed,
      remainingHostHours: hostSummary.totalAvailableHours,
      relayEnabled: updated.status !== "ENDED",
      status: updated.status,
    }
  })
}

export async function canPlayerEnableRelay(input: {
  lobbyCode: string
  playerId: string
}) {
  const code = input.lobbyCode.trim().toUpperCase()
  const playerId = input.playerId.trim()
  if (!code || !playerId) {
    return false
  }

  const lobby = await prisma.lobby.findUnique({
    where: { code },
    select: { id: true },
  })
  if (!lobby) {
    return false
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { authUserId: true, lobbyId: true },
  })
  if (!player || player.lobbyId !== lobby.id) {
    return false
  }

  if (player.authUserId) {
    const self = await getRelayProfile(player.authUserId)
    if (self.totalAvailableHours > 0) {
      return true
    }
  }

  const approved = await prisma.relaySession.findFirst({
    where: {
      lobbyId: lobby.id,
      requesterPlayerId: playerId,
      status: { in: ["APPROVED", "ACTIVE"] },
      expiresAt: { gte: new Date() },
    },
    select: { id: true },
  })
  return Boolean(approved)
}

export async function applyRelayPurchaseForUser(input: {
  userId: string
  planType?: PlanType
  creditPack?: CreditPackType
}) {
  if (input.planType) {
    return setRelayPlan(input.userId, input.planType)
  }
  if (input.creditPack) {
    return grantCreditPack(input.userId, input.creditPack)
  }
  return getRelayProfile(input.userId)
}

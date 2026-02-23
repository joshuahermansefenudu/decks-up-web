import { Prisma, type PlanType, type RelaySessionStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE =
  // This value is in "minutes of relay credit per participant-minute".
  // Example: 0.2 means each active participant consumes 0.2 minutes of credit per minute.
  // We convert to hours at deduction time because buckets are stored in hours.
  Number.parseFloat(process.env.RELAY_BASE_RATE_PER_MINUTE ?? "0.2") || 0.2
export const RELAY_MAX_PARTICIPANTS = Number.parseInt(
  process.env.RELAY_MAX_VIDEO_PARTICIPANTS ?? "6",
  10
)
const RELAY_TICK_INTERVAL_MS = 60_000
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
  relayHoursSharedByHost: number
  relaySharedParticipantCount: number
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
  relaySharers: {
    playerId: string
    name: string
    planType: PlanType
    availableHours: number
  }[]
}

export type RelayGameSummary = {
  gameDurationMinutes: number
  relayMinutesSpent: number
  relayHoursShared: number
  remainingSubscriptionHours: number
  planType: PlanType
  hasSubscription: boolean
}

type RelayPlayerContext = {
  id: string
  name: string
  isHost: boolean
  authUserId: string | null
  summary: RelayProfileSummary | null
  totalAvailableHours: number
  planType: PlanType
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

function toHoursFromMinutes(value: number) {
  return value / 60
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
  // Stripe-managed subscriptions grant monthly hours through verified webhooks.
  // Skip local time-based renewals to avoid duplicate monthly grants.
  if (profile.isStripeManaged) {
    return
  }
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

async function getRelayProfileInTx(
  userId: string,
  now: Date,
  db: RelayDbClient
): Promise<RelayProfileSummary> {
  await ensureProfile(userId, db)
  await pruneExpiredBuckets(userId, now, db)
  await runRenewalIfDue(userId, now, db)
  return recomputeProfileSummary(userId, now, db)
}

async function buildRelayPlayerContexts(
  players: Array<{
    id: string
    name: string
    isHost: boolean
    authUserId: string | null
  }>,
  options?: { db?: RelayDbClient; now?: Date }
): Promise<RelayPlayerContext[]> {
  const summaries = new Map<string, RelayProfileSummary>()
  const db = options?.db
  const now = options?.now ?? new Date()
  const authUserIds = [
    ...new Set(players.map((player) => player.authUserId).filter(Boolean)),
  ] as string[]

  await Promise.all(
    authUserIds.map(async (userId) => {
      const summary = db
        ? await getRelayProfileInTx(userId, now, db)
        : await getRelayProfile(userId)
      summaries.set(userId, summary)
    })
  )

  return players.map((player) => {
    const summary = player.authUserId ? summaries.get(player.authUserId) ?? null : null
    return {
      ...player,
      summary,
      totalAvailableHours: summary?.totalAvailableHours ?? 0,
      planType: summary?.planType ?? "FREE",
    }
  })
}

function pickPreferredSharer(
  sharers: RelayPlayerContext[],
  requestedSharerId?: string | null
): RelayPlayerContext | null {
  if (!sharers.length) {
    return null
  }

  if (requestedSharerId) {
    return sharers.find((sharer) => sharer.id === requestedSharerId) ?? null
  }

  const hostSharer = sharers.find((sharer) => sharer.isHost)
  if (hostSharer) {
    return hostSharer
  }

  return sharers
    .slice()
    .sort((a, b) => b.totalAvailableHours - a.totalAvailableHours)[0]
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
        isStripeManaged: false,
        stripeSubscriptionStatus: null,
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
  sharerPlayerId?: string
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date()
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

    const players = await tx.player.findMany({
      where: {
        lobbyId: lobby.id,
        leftAt: null,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        authUserId: true,
        isHost: true,
      },
    })

    const contexts = await buildRelayPlayerContexts(players, { db: tx, now })
    const requester = contexts.find((player) => player.id === requesterPlayerId)
    if (!requester) {
      throw new Error("requester_not_active")
    }
    if (requester.totalAvailableHours > 0) {
      throw new Error("requester_has_credits")
    }

    const sharerCandidates = contexts.filter(
      (player) =>
        player.id !== requester.id &&
        Boolean(player.authUserId) &&
        player.totalAvailableHours > 0
    )
    if (!sharerCandidates.length) {
      throw new Error("no_sharer_available")
    }

    const sharer = pickPreferredSharer(
      sharerCandidates,
      input.sharerPlayerId?.trim() ?? null
    )
    if (!sharer || !sharer.authUserId) {
      throw new Error("selected_sharer_unavailable")
    }

    const activeForSharer = await tx.relaySession.count({
      where: {
        lobbyId: lobby.id,
        hostPlayerId: sharer.id,
        status: { in: ["APPROVED", "ACTIVE"] },
        expiresAt: { gte: now },
      },
    })
    if (activeForSharer >= RELAY_MAX_PARTICIPANTS) {
      throw new Error("relay_sharer_capacity_reached")
    }

    const openExisting = await tx.relaySession.findFirst({
      where: {
        lobbyId: lobby.id,
        requesterPlayerId: requester.id,
        hostPlayerId: sharer.id,
        status: { in: ["PENDING", "APPROVED", "ACTIVE"] },
        expiresAt: { gte: now },
      },
      orderBy: { createdAt: "desc" },
    })
    if (openExisting) {
      return {
        requestId: openExisting.id,
        status: openExisting.status,
        sharerPlayerId: sharer.id,
      }
    }

    const created = await tx.relaySession.create({
      data: {
        lobbyId: lobby.id,
        requesterPlayerId: requester.id,
        requesterUserId: requester.authUserId,
        hostPlayerId: sharer.id,
        hostUserId: sharer.authUserId,
        status: "PENDING",
        maxMinutesGranted: 30,
        expiresAt: addDays(now, 1),
        baseRate: RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE,
      },
      select: { id: true, status: true },
    })

    return {
      requestId: created.id,
      status: created.status,
      sharerPlayerId: sharer.id,
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
    const now = new Date()
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
      if (!relayRequest.hostUserId) {
        throw new Error("host_no_credits")
      }
      const host = await getRelayProfileInTx(relayRequest.hostUserId, now, tx)
      if (host.totalAvailableHours <= 0) {
        throw new Error("host_no_credits")
      }

      const activeForSharer = await tx.relaySession.count({
        where: {
          lobbyId: relayRequest.lobbyId,
          hostPlayerId: relayRequest.hostPlayerId,
          status: { in: ["APPROVED", "ACTIVE"] },
          expiresAt: { gte: now },
        },
      })
      if (activeForSharer >= RELAY_MAX_PARTICIPANTS) {
        throw new Error("relay_sharer_capacity_reached")
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

export async function shareRelayHours(input: {
  lobbyCode: string
  sharerPlayerId: string
  requesterPlayerIds: string[]
  maxMinutesGranted?: number
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date()
    const code = input.lobbyCode.trim().toUpperCase()
    const sharerPlayerId = input.sharerPlayerId.trim()
    const requesterPlayerIds = [
      ...new Set(input.requesterPlayerIds.map((id) => id.trim()).filter(Boolean)),
    ]
    if (!code || !sharerPlayerId || !requesterPlayerIds.length) {
      throw new Error("invalid_request")
    }

    const lobby = await tx.lobby.findUnique({
      where: { code },
      select: { id: true, mode: true, status: true },
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

    const players = await tx.player.findMany({
      where: { lobbyId: lobby.id, leftAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        authUserId: true,
      },
    })

    const sharer = players.find((player) => player.id === sharerPlayerId)
    if (!sharer || !sharer.authUserId) {
      throw new Error("sharer_not_eligible")
    }

    const sharerSummary = await getRelayProfileInTx(sharer.authUserId, now, tx)
    if (sharerSummary.totalAvailableHours <= 0) {
      throw new Error("host_no_credits")
    }

    const activeRelayCount = await tx.relaySession.count({
      where: {
        lobbyId: lobby.id,
        hostPlayerId: sharer.id,
        status: { in: ["APPROVED", "ACTIVE"] },
        expiresAt: { gte: now },
      },
    })

    let availableSlots = Math.max(0, RELAY_MAX_PARTICIPANTS - activeRelayCount)
    if (availableSlots <= 0) {
      throw new Error("relay_sharer_capacity_reached")
    }

    const approved: string[] = []
    const skipped: Array<{ playerId: string; reason: string }> = []
    const maxMinutesGranted = input.maxMinutesGranted
      ? Math.max(5, Math.min(120, Math.floor(input.maxMinutesGranted)))
      : 30

    for (const requesterPlayerId of requesterPlayerIds) {
      if (requesterPlayerId === sharerPlayerId) {
        skipped.push({ playerId: requesterPlayerId, reason: "cannot_share_to_self" })
        continue
      }

      const requester = players.find((player) => player.id === requesterPlayerId)
      if (!requester) {
        skipped.push({ playerId: requesterPlayerId, reason: "requester_not_active" })
        continue
      }

      const existing = await tx.relaySession.findFirst({
        where: {
          lobbyId: lobby.id,
          requesterPlayerId,
          hostPlayerId: sharer.id,
          status: { in: ["PENDING", "APPROVED", "ACTIVE"] },
          expiresAt: { gte: now },
        },
        orderBy: { createdAt: "desc" },
      })

      if (existing?.status === "APPROVED" || existing?.status === "ACTIVE") {
        approved.push(requesterPlayerId)
        continue
      }

      if (availableSlots <= 0) {
        skipped.push({ playerId: requesterPlayerId, reason: "relay_sharer_capacity_reached" })
        continue
      }

      if (existing?.status === "PENDING") {
        await tx.relaySession.update({
          where: { id: existing.id },
          data: {
            status: "APPROVED",
            maxMinutesGranted,
            note: "approved_by_sharer",
          },
        })
      } else {
        await tx.relaySession.create({
          data: {
            lobbyId: lobby.id,
            requesterPlayerId,
            requesterUserId: requester.authUserId,
            hostPlayerId: sharer.id,
            hostUserId: sharer.authUserId,
            status: "APPROVED",
            maxMinutesGranted,
            expiresAt: addDays(now, 1),
            baseRate: RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE,
            note: "shared_by_sharer",
          },
        })
      }

      availableSlots -= 1
      approved.push(requesterPlayerId)
    }

    return {
      approvedPlayerIds: approved,
      skipped,
    }
  })
}

export async function getRelayState(input: {
  lobbyCode: string
  playerId: string
}) {
  const now = new Date()
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

  const contexts = await buildRelayPlayerContexts(players)
  const selfContext = contexts.find((player) => player.id === playerId)
  if (!selfContext) {
    throw new Error("player_not_found")
  }

  const hostPlayer = contexts.find((player) => player.id === lobby.hostPlayerId)
  const hostSummary = hostPlayer?.summary ?? null
  const activeVideoParticipants = Math.min(players.length, RELAY_MAX_PARTICIPANTS)
  const burnRatePerMinute = roundHours(
    toHoursFromMinutes(
      activeVideoParticipants * RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE
    )
  )

  const selfSummary = selfContext.summary

  const activeSession = await prisma.relaySession.findFirst({
    where: {
      lobbyId: lobby.id,
      status: { in: ["APPROVED", "ACTIVE"] },
      expiresAt: { gte: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      requesterPlayerId: true,
      hostPlayerId: true,
      maxMinutesGranted: true,
      startedAt: true,
      note: true,
    },
  })

  const pendingSessionGlobal = await prisma.relaySession.findFirst({
    where: {
      lobbyId: lobby.id,
      status: "PENDING",
      expiresAt: { gte: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      requesterPlayerId: true,
    },
  })

  const pendingRequester = pendingSessionGlobal
    ? players.find((player) => player.id === pendingSessionGlobal.requesterPlayerId)
    : null

  const sharers = contexts
    .filter(
      (player) =>
        player.id !== selfContext.id &&
        Boolean(player.authUserId) &&
        player.totalAvailableHours > 0
    )
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      planType: player.planType,
      availableHours: roundHours(player.totalAvailableHours),
    }))

  const pendingForViewer = await prisma.relaySession.findMany({
    where: {
      lobbyId: lobby.id,
      hostPlayerId: selfContext.id,
      status: "PENDING",
      expiresAt: { gte: now },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      requesterPlayerId: true,
    },
  })

  const incomingRelayRequests = pendingForViewer
    .map((request) => {
      const requester = players.find(
        (player) => player.id === request.requesterPlayerId
      )
      if (!requester) {
        return null
      }
      return {
        requestId: request.id,
        requesterPlayerId: request.requesterPlayerId,
        requesterName: requester.name,
        estimatedBurnRatePerMinute: burnRatePerMinute,
      }
    })
    .filter(
      (
        request
      ): request is {
        requestId: string
        requesterPlayerId: string
        requesterName: string
        estimatedBurnRatePerMinute: number
      } => request !== null
    )

  const activeOrApprovedForSelf = await prisma.relaySession.findFirst({
    where: {
      lobbyId: lobby.id,
      requesterPlayerId: selfContext.id,
      status: { in: ["APPROVED", "ACTIVE"] },
      expiresAt: { gte: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      hostPlayerId: true,
      status: true,
    },
  })

  const alreadySharedByViewer = new Set(
    (
      await prisma.relaySession.findMany({
        where: {
          lobbyId: lobby.id,
          hostPlayerId: selfContext.id,
          status: { in: ["APPROVED", "ACTIVE"] },
          expiresAt: { gte: now },
        },
        select: { requesterPlayerId: true },
      })
    ).map((session) => session.requesterPlayerId)
  )

  const canEnableRelaySelf = Boolean(
    (selfSummary && selfSummary.totalAvailableHours > 0) || activeOrApprovedForSelf
  )
  const canShareRelay = Boolean(selfSummary && selfSummary.totalAvailableHours > 0)

  const canRequestRelayFromSharers =
    !canEnableRelaySelf &&
    sharers.length > 0 &&
    lobby.mode === "VIRTUAL" &&
    lobby.status === "IN_GAME"

  const shareCandidates = contexts
    .filter((player) => player.id !== selfContext.id)
    .filter((player) => player.totalAvailableHours <= 0)
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      planType: player.planType,
      hasOwnRelayHours: player.totalAvailableHours > 0,
      alreadySharedByViewer: alreadySharedByViewer.has(player.id),
    }))

  const relayHasAnyCredits = contexts.some(
    (player) => player.totalAvailableHours > 0
  )
  const activeRelaySharer = activeSession?.hostPlayerId
    ? contexts.find((player) => player.id === activeSession.hostPlayerId) ?? null
    : null
  const relayHoursOwner = activeRelaySharer ?? hostPlayer ?? null
  const relayDisabledReason =
    !relayHasAnyCredits && !canEnableRelaySelf
      ? "no_credits"
      : lobby.mode !== "VIRTUAL"
        ? "relay_only_virtual"
        : null

  let relayHoursSharedByHost = 0
  let relaySharedParticipantCount = 0
  if (selfContext.id === lobby.hostPlayerId) {
    const hostRelaySessions = await prisma.relaySession.findMany({
      where: {
        lobbyId: lobby.id,
        hostPlayerId: lobby.hostPlayerId,
        startedAt: { not: null },
      },
      select: {
        requesterPlayerId: true,
        startedAt: true,
        endedAt: true,
        maxMinutesGranted: true,
        activeVideoParticipants: true,
        baseRate: true,
      },
    })

    const sharedRequesterIds = new Set<string>()
    let sharedHours = 0
    for (const session of hostRelaySessions) {
      if (!session.startedAt) {
        continue
      }
      const cappedEnd = session.endedAt ?? now
      const rawMinutes = Math.max(
        0,
        (cappedEnd.getTime() - session.startedAt.getTime()) / 60_000
      )
      const maxMinutes = Math.max(
        1,
        Math.min(
          session.maxMinutesGranted ?? RELAY_SESSION_MAX_MINUTES,
          RELAY_SESSION_MAX_MINUTES
        )
      )
      const effectiveMinutes = Math.min(rawMinutes, maxMinutes)
      const participants = Math.max(
        1,
        Math.min(
          session.activeVideoParticipants || activeVideoParticipants,
          RELAY_MAX_PARTICIPANTS
        )
      )
      const sessionRate =
        Number.isFinite(session.baseRate) && session.baseRate > 0
          ? session.baseRate
          : RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE
      sharedHours += toHoursFromMinutes(
        effectiveMinutes * participants * sessionRate
      )
      sharedRequesterIds.add(session.requesterPlayerId)
    }

    relayHoursSharedByHost = roundHours(sharedHours)
    relaySharedParticipantCount = sharedRequesterIds.size
  }

  return {
    room: {
      relayEnabled: Boolean(activeSession),
      relayStatus: activeSession?.status ?? "NONE",
      activeVideoParticipants,
      burnRatePerMinute,
      relayHoursSharedByHost,
      relaySharedParticipantCount,
      remainingHostHours: relayHoursOwner?.totalAvailableHours ?? 0,
      hostPlanType: relayHoursOwner?.planType ?? "FREE",
      relayDisabledReason,
      maxRelayParticipants: RELAY_MAX_PARTICIPANTS,
      activeRequesterPlayerId: activeSession?.requesterPlayerId ?? null,
      pendingRequest:
        pendingSessionGlobal && pendingRequester
          ? {
              requestId: pendingSessionGlobal.id,
              requesterPlayerId: pendingSessionGlobal.requesterPlayerId,
              requesterName: pendingRequester.name,
              estimatedBurnRatePerMinute: burnRatePerMinute,
            }
          : null,
      relaySharers: sharers,
    },
    viewer: {
      planType: selfSummary?.planType ?? "FREE",
      isHost: selfContext.isHost,
      canEnableRelay: canEnableRelaySelf,
      canRequestRelay: canRequestRelayFromSharers,
      canShareRelay,
      totalAvailableHours: selfSummary?.totalAvailableHours ?? 0,
      lowCreditWarning: Boolean(selfSummary?.lowCreditWarning),
      expiringSoonWarning: Boolean(selfSummary?.expiringHoursWithin7Days),
      expiringHoursWithin7Days: selfSummary?.expiringHoursWithin7Days ?? 0,
      expiringInDays: selfSummary?.expiringInDays ?? null,
      activeRelaySessionId: activeOrApprovedForSelf?.id ?? null,
      approvedByPlayerId: activeOrApprovedForSelf?.hostPlayerId ?? null,
      requestableSharers: sharers,
      shareCandidates,
      incomingRelayRequests,
    },
  }
}

export async function getRelayGameSummaryForUser(input: {
  lobbyId: string
  gameStartedAt: Date
  gameEndedAt?: Date | null
  authUserId?: string | null
}): Promise<RelayGameSummary> {
  const now = new Date()
  const sessionEnd = input.gameEndedAt ?? now
  const gameDurationMinutes = Math.max(
    0,
    Math.round((sessionEnd.getTime() - input.gameStartedAt.getTime()) / 60_000)
  )

  if (!input.authUserId) {
    return {
      gameDurationMinutes,
      relayMinutesSpent: 0,
      relayHoursShared: 0,
      remainingSubscriptionHours: 0,
      planType: "FREE",
      hasSubscription: false,
    }
  }

  const [profile, sessions] = await Promise.all([
    getRelayProfile(input.authUserId),
    prisma.relaySession.findMany({
      where: {
        lobbyId: input.lobbyId,
        hostUserId: input.authUserId,
        startedAt: { not: null },
      },
      select: {
        startedAt: true,
        endedAt: true,
        maxMinutesGranted: true,
        activeVideoParticipants: true,
        baseRate: true,
      },
    }),
  ])

  let relayMinutesSpent = 0
  let relayHoursShared = 0
  for (const session of sessions) {
    if (!session.startedAt) {
      continue
    }
    const cappedEnd = session.endedAt ?? sessionEnd
    const rawMinutes = Math.max(
      0,
      (cappedEnd.getTime() - session.startedAt.getTime()) / 60_000
    )
    const maxMinutes = Math.max(
      1,
      Math.min(
        session.maxMinutesGranted ?? RELAY_SESSION_MAX_MINUTES,
        RELAY_SESSION_MAX_MINUTES
      )
    )
    relayMinutesSpent += Math.min(rawMinutes, maxMinutes)
    const participants = Math.max(
      1,
      Math.min(
        session.activeVideoParticipants || 1,
        RELAY_MAX_PARTICIPANTS
      )
    )
    const sessionRate =
      Number.isFinite(session.baseRate) && session.baseRate > 0
        ? session.baseRate
        : RELAY_BASE_RATE_PER_PARTICIPANT_MINUTE
    relayHoursShared += toHoursFromMinutes(
      Math.min(rawMinutes, maxMinutes) * participants * sessionRate
    )
  }

  return {
    gameDurationMinutes,
    relayMinutesSpent: Number(relayMinutesSpent.toFixed(1)),
    relayHoursShared: roundHours(relayHoursShared),
    remainingSubscriptionHours: profile.totalAvailableHours,
    planType: profile.planType,
    hasSubscription: profile.planType !== "FREE",
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

    const lastBillingAnchor = session.lastDeductedAt ?? startedAt
    const elapsedSinceLastBillingMs = now.getTime() - lastBillingAnchor.getTime()

    if (elapsedSinceLastBillingMs < RELAY_TICK_INTERVAL_MS) {
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
    const elapsedBillingMinutes = elapsedSinceLastBillingMs / 60_000
    const amount = roundHours(
      toHoursFromMinutes(participants * session.baseRate) * elapsedBillingMinutes
    )

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

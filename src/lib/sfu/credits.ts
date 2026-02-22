import { SFU_CONFIG } from "@/lib/sfu/config"
import { logEvent } from "@/lib/sfu/telemetry"

export type RelayApprovalRecord = {
  requesterId: string
  approved: boolean
  relayActive: boolean
  grantedAtMs?: number
  maxMinutesGranted?: number
}

export type CreditRuntimeState = {
  roomId: string
  hostId: string
  hostCredits: number
  activeVideoParticipants: number
  relayApprovals: RelayApprovalRecord[]
  sessionStartedAtMs: number
  maxRelayParticipants: number
  sessionMaxDurationMinutes: number
  baseRateCreditsPerParticipantMinute: number
  allowPayAsYouGoOverage: boolean
  overageRatePerMinuteCredits: number
  overageUsedCredits: number
}

export function enforceRelayCaps(state: CreditRuntimeState): {
  nextState: CreditRuntimeState
  revokedRequesterIds: string[]
  shouldEndRelay: boolean
} {
  const now = Date.now()
  const elapsedMinutes = (now - state.sessionStartedAtMs) / 60_000

  let approvals = [...state.relayApprovals]
  const revokedRequesterIds: string[] = []

  const activeRelay = approvals.filter((record) => record.relayActive)
  if (activeRelay.length > state.maxRelayParticipants) {
    const overflow = activeRelay.slice(state.maxRelayParticipants)
    const revokeSet = new Set(overflow.map((record) => record.requesterId))
    approvals = approvals.map((record) =>
      revokeSet.has(record.requesterId)
        ? { ...record, approved: false, relayActive: false }
        : record
    )
    revokedRequesterIds.push(...overflow.map((record) => record.requesterId))
  }

  if (elapsedMinutes >= state.sessionMaxDurationMinutes || state.hostCredits <= 0) {
    const toRevoke = approvals.filter((record) => record.relayActive)
    approvals = approvals.map((record) => ({
      ...record,
      approved: false,
      relayActive: false,
    }))
    revokedRequesterIds.push(...toRevoke.map((record) => record.requesterId))
  }

  return {
    nextState: {
      ...state,
      relayApprovals: approvals,
    },
    revokedRequesterIds,
    shouldEndRelay:
      elapsedMinutes >= state.sessionMaxDurationMinutes || state.hostCredits <= 0,
  }
}

export async function deductCreditsTick(
  state: CreditRuntimeState
): Promise<CreditRuntimeState> {
  const relayUsersApproved = state.relayApprovals.filter(
    (record) => record.approved && record.relayActive
  ).length

  if (relayUsersApproved <= 0 || state.activeVideoParticipants <= 0) {
    return state
  }

  const amount =
    relayUsersApproved *
    state.activeVideoParticipants *
    state.baseRateCreditsPerParticipantMinute

  let nextHostCredits = state.hostCredits - amount
  let nextOverage = state.overageUsedCredits

  if (nextHostCredits < 0) {
    if (state.allowPayAsYouGoOverage) {
      nextOverage += Math.abs(nextHostCredits)
      nextHostCredits = 0
    } else {
      nextHostCredits = 0
    }
  }

  await logEvent("DEDUCT_TICK", {
    roomId: state.roomId,
    hostId: state.hostId,
    participants: state.activeVideoParticipants,
    relayUsers: relayUsersApproved,
    amount,
    remainingBankMinutes: Math.floor(nextHostCredits),
    overageUsedCredits: nextOverage,
  })

  const { nextState } = enforceRelayCaps({
    ...state,
    hostCredits: nextHostCredits,
    overageUsedCredits: nextOverage,
  })

  return nextState
}

export function createDefaultCreditRuntimeState(
  roomId: string,
  hostId: string,
  hostCredits: number
): CreditRuntimeState {
  return {
    roomId,
    hostId,
    hostCredits,
    activeVideoParticipants: 0,
    relayApprovals: [],
    sessionStartedAtMs: Date.now(),
    maxRelayParticipants: SFU_CONFIG.relay.maxRelayParticipants,
    sessionMaxDurationMinutes: SFU_CONFIG.relay.sessionMaxDurationMinutes,
    baseRateCreditsPerParticipantMinute:
      SFU_CONFIG.credits.baseRateCreditsPerParticipantMinute,
    allowPayAsYouGoOverage: SFU_CONFIG.credits.allowPayAsYouGoOverage,
    overageRatePerMinuteCredits: SFU_CONFIG.credits.overageRatePerMinuteCredits,
    overageUsedCredits: 0,
  }
}


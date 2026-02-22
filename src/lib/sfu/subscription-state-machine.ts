import { SFU_CONFIG } from "@/lib/sfu/config"

export type PricingState = "STANDARD_PRICING" | "DISCOUNTED_PRICING"

export type SubscriptionPlanState = {
  hostId: string
  monthlyGrantMinutes: number
  bankCapMinutes: number
  bankedMinutes: number
  standardPriceCents: number
  discountedPriceCents: number
  overageRatePerMinuteCredits: number
  pricingState: PricingState
  nextRenewalAtIso: string
}

export function createInitialSubscriptionState(
  hostId: string
): SubscriptionPlanState {
  const grant = SFU_CONFIG.credits.monthlyGrantMinutes
  return {
    hostId,
    monthlyGrantMinutes: grant,
    bankCapMinutes: grant * SFU_CONFIG.credits.bankMonthsCap,
    bankedMinutes: grant,
    standardPriceCents: SFU_CONFIG.credits.standardPriceCents,
    discountedPriceCents: SFU_CONFIG.credits.discountedPriceCents,
    overageRatePerMinuteCredits: SFU_CONFIG.credits.overageRatePerMinuteCredits,
    pricingState: "STANDARD_PRICING",
    nextRenewalAtIso: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

export function consumeBankMinutes(
  state: SubscriptionPlanState,
  minutes: number
): SubscriptionPlanState {
  return {
    ...state,
    bankedMinutes: Math.max(0, state.bankedMinutes - Math.max(0, minutes)),
  }
}

export function renewSubscription(
  state: SubscriptionPlanState
): {
  nextState: SubscriptionPlanState
  chargedPriceCents: number
} {
  const chargedPriceCents =
    state.pricingState === "DISCOUNTED_PRICING"
      ? state.discountedPriceCents
      : state.standardPriceCents

  const nextBank = Math.min(
    state.bankCapMinutes,
    state.bankedMinutes + state.monthlyGrantMinutes
  )

  // Loyalty discount rule:
  // If bankedMinutes > 0 at renewal, next cycle remains discounted.
  // If bankedMinutes === 0 at renewal, next cycle reverts to standard.
  const nextPricingState: PricingState =
    state.bankedMinutes > 0 ? "DISCOUNTED_PRICING" : "STANDARD_PRICING"

  return {
    chargedPriceCents,
    nextState: {
      ...state,
      bankedMinutes: nextBank,
      pricingState: nextPricingState,
      nextRenewalAtIso: new Date(
        Date.parse(state.nextRenewalAtIso) + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
  }
}

export const sampleSubscriptionStateJson: SubscriptionPlanState = {
  hostId: "host_123",
  monthlyGrantMinutes: 300,
  bankCapMinutes: 900,
  bankedMinutes: 220,
  standardPriceCents: 999,
  discountedPriceCents: 799,
  overageRatePerMinuteCredits: 2,
  pricingState: "DISCOUNTED_PRICING",
  nextRenewalAtIso: "2026-03-19T00:00:00.000Z",
}


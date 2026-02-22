import assert from "node:assert/strict"
import test from "node:test"

import {
  createInitialSubscriptionState,
  consumeBankMinutes,
  renewSubscription,
} from "@/lib/sfu/subscription-state-machine"

test("bank is capped at 3x monthly grant on renewal", () => {
  const initial = createInitialSubscriptionState("host_a")
  const fullBank = {
    ...initial,
    bankedMinutes: initial.bankCapMinutes,
  }

  const { nextState } = renewSubscription(fullBank)
  assert.equal(nextState.bankedMinutes, initial.bankCapMinutes)
})

test("discount persists when banked minutes are available at renewal", () => {
  const initial = createInitialSubscriptionState("host_b")
  const beforeRenewal = {
    ...initial,
    bankedMinutes: 10,
    pricingState: "DISCOUNTED_PRICING" as const,
  }

  const { nextState } = renewSubscription(beforeRenewal)
  assert.equal(nextState.pricingState, "DISCOUNTED_PRICING")
})

test("pricing reverts to standard when bank hits zero at renewal", () => {
  const initial = createInitialSubscriptionState("host_c")
  const depleted = consumeBankMinutes(initial, initial.bankedMinutes)
  const { nextState } = renewSubscription(depleted)
  assert.equal(nextState.pricingState, "STANDARD_PRICING")
})


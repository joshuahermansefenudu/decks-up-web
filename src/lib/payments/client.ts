export type PurchaseKind = "SUBSCRIPTION" | "CREDIT_PACK"
export type PurchasePlanType = "CORE" | "PRO"
export type PurchaseCreditPack = "STARTER" | "STANDARD" | "PARTY"

export type CheckoutSessionResponse = {
  mode: "embedded"
  sessionId: string
  clientSecret: string
  publishableKey: string
} | {
  mode: "redirect"
  sessionId: string
  checkoutUrl: string
}

export type SubscriptionSummaryResponse = {
  subscription: {
    stripeSubscriptionId: string
    stripePriceId: string
    planType: "FREE" | "CORE" | "PRO"
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    isStripeManaged: boolean
  } | null
  relayProfile?: {
    planType: "FREE" | "CORE" | "PRO"
    totalAvailableHours: number
    bankedHours: number
    loyaltyActive: boolean
    lowCreditWarning: boolean
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T
}

function authHeaders(accessToken: string, contentType = true) {
  return {
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${accessToken}`,
  }
}

export async function createCheckoutSession(input: {
  accessToken: string
  kind: PurchaseKind
  planType?: PurchasePlanType
  creditPack?: PurchaseCreditPack
  originContext: "game" | "account" | "pricing"
  originPath?: string
}) {
  const response = await fetch("/api/payments/checkout-session", {
    method: "POST",
    headers: authHeaders(input.accessToken),
    body: JSON.stringify(input),
  })
  const payload = await parseJson<CheckoutSessionResponse & { error?: string }>(
    response
  )

  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to start checkout.")
  }

  return payload
}

export async function getCheckoutStatus(input: {
  accessToken: string
  sessionId: string
}) {
  const response = await fetch(
    `/api/payments/checkout-session/${encodeURIComponent(input.sessionId)}`,
    {
      headers: authHeaders(input.accessToken, false),
      cache: "no-store",
    }
  )
  const payload = await parseJson<{ status?: string; error?: string }>(response)
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to check checkout status.")
  }
  return payload.status ?? "UNKNOWN"
}

export async function changeSubscriptionPlan(input: {
  accessToken: string
  planType: PurchasePlanType
}) {
  const response = await fetch("/api/payments/subscription/change-plan", {
    method: "POST",
    headers: authHeaders(input.accessToken),
    body: JSON.stringify({ planType: input.planType }),
  })
  const payload = await parseJson<{ error?: string }>(response)
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to change plan.")
  }
}

export async function cancelSubscription(accessToken: string) {
  const response = await fetch("/api/payments/subscription/cancel", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  })
  const payload = await parseJson<{ error?: string }>(response)
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to cancel subscription.")
  }
}

export async function getSubscriptionSummary(accessToken: string) {
  const response = await fetch("/api/payments/subscription", {
    headers: authHeaders(accessToken, false),
    cache: "no-store",
  })
  const payload = await parseJson<SubscriptionSummaryResponse & { error?: string }>(
    response
  )
  if (!response.ok) {
    throw new Error(payload.error ?? "Unable to load subscription.")
  }
  return payload
}

export async function waitForWebhookEntitlements(input: {
  accessToken: string
  sessionId: string
  timeoutMs?: number
  pollIntervalMs?: number
}) {
  const timeoutMs = input.timeoutMs ?? 25_000
  const pollIntervalMs = input.pollIntervalMs ?? 1500
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const status = await getCheckoutStatus({
      accessToken: input.accessToken,
      sessionId: input.sessionId,
    })
    if (status === "COMPLETED") {
      return { completed: true as const }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return { completed: false as const }
}

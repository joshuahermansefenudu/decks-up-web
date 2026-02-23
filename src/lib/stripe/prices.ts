import type { PlanType } from "@prisma/client"

export type PaidPlanType = Exclude<PlanType, "FREE">
export type CreditPackType = "STARTER" | "STANDARD" | "PARTY"

const PLAN_PRICE_ENV: Record<PaidPlanType, { standard: string; loyalty: string }> = {
  CORE: {
    standard: "STRIPE_PRICE_CORE_STANDARD",
    loyalty: "STRIPE_PRICE_CORE_LOYALTY",
  },
  PRO: {
    standard: "STRIPE_PRICE_PRO_STANDARD",
    loyalty: "STRIPE_PRICE_PRO_LOYALTY",
  },
}

const PACK_PRICE_ENV: Record<CreditPackType, string> = {
  STARTER: "STRIPE_PRICE_PACK_STARTER",
  STANDARD: "STRIPE_PRICE_PACK_STANDARD",
  PARTY: "STRIPE_PRICE_PACK_PARTY",
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

export function getStripePublishableKey(): string {
  return getRequiredEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
}

export function getStripeSecretKey(): string {
  return getRequiredEnv("STRIPE_SECRET_KEY")
}

export function getStripeWebhookSecret(): string {
  return getRequiredEnv("STRIPE_WEBHOOK_SECRET")
}

export function getStripePlanPriceId(
  planType: PaidPlanType,
  options?: { loyalty?: boolean }
): string {
  const envName = options?.loyalty
    ? PLAN_PRICE_ENV[planType].loyalty
    : PLAN_PRICE_ENV[planType].standard
  return getRequiredEnv(envName)
}

export function getStripeCreditPackPriceId(creditPack: CreditPackType): string {
  return getRequiredEnv(PACK_PRICE_ENV[creditPack])
}

export function getPlanFromPriceId(priceId: string): {
  planType: PaidPlanType
  loyalty: boolean
} | null {
  const normalized = priceId.trim()
  if (!normalized) {
    return null
  }

  for (const planType of Object.keys(PLAN_PRICE_ENV) as PaidPlanType[]) {
    const standard = process.env[PLAN_PRICE_ENV[planType].standard]?.trim()
    const loyalty = process.env[PLAN_PRICE_ENV[planType].loyalty]?.trim()

    if (normalized === standard) {
      return { planType, loyalty: false }
    }
    if (normalized === loyalty) {
      return { planType, loyalty: true }
    }
  }

  return null
}

export function getCreditPackFromPriceId(priceId: string): CreditPackType | null {
  const normalized = priceId.trim()
  if (!normalized) {
    return null
  }

  for (const creditPack of Object.keys(PACK_PRICE_ENV) as CreditPackType[]) {
    const envValue = process.env[PACK_PRICE_ENV[creditPack]]?.trim()
    if (normalized === envValue) {
      return creditPack
    }
  }

  return null
}

export function getCheckoutReturnUrl(origin: string, originPath?: string): string {
  const configured = process.env.STRIPE_BILLING_RETURN_URL?.trim()
  if (configured) {
    return configured
  }

  const safePath =
    originPath && originPath.startsWith("/")
      ? originPath
      : "/account?billing=success"

  return `${origin}${safePath}`
}

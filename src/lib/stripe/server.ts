import { Prisma } from "@prisma/client"
import Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { getStripeSecretKey } from "@/lib/stripe/prices"

const globalStripe = globalThis as unknown as {
  stripe?: Stripe
}

export const STRIPE_API_VERSION =
  (process.env.STRIPE_API_VERSION?.trim() as Stripe.LatestApiVersion | undefined) ??
  undefined

function createStripeClient() {
  const secretKey = getStripeSecretKey()
  return new Stripe(secretKey, {
    ...(STRIPE_API_VERSION ? { apiVersion: STRIPE_API_VERSION } : {}),
  })
}

export function getStripeServerClient() {
  if (globalStripe.stripe) {
    return globalStripe.stripe
  }

  const client = createStripeClient()
  if (process.env.NODE_ENV !== "production") {
    globalStripe.stripe = client
  }
  return client
}

async function ensureRelayProfileForBilling(userId: string) {
  await prisma.userRelayProfile.upsert({
    where: { userId },
    create: {
      userId,
      planType: "FREE",
      monthlyHours: 0,
      bankedHours: 0,
      loyaltyActive: false,
      isStripeManaged: false,
      lastRenewalDate: new Date(),
    },
    update: {},
  })
}

export async function ensureStripeCustomer(input: {
  userId: string
  email?: string | null
}) {
  await ensureRelayProfileForBilling(input.userId)

  const existing = await prisma.billingCustomer.findUnique({
    where: { userId: input.userId },
  })

  if (existing) {
    return existing
  }

  const stripe = getStripeServerClient()
  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    metadata: {
      userId: input.userId,
    },
  })

  try {
    return await prisma.billingCustomer.create({
      data: {
        userId: input.userId,
        stripeCustomerId: customer.id,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const fallback = await prisma.billingCustomer.findUnique({
        where: { userId: input.userId },
      })
      if (fallback) {
        return fallback
      }
    }
    throw error
  }
}

export function unixToDate(value?: number | null): Date | null {
  if (!value || !Number.isFinite(value)) {
    return null
  }
  return new Date(value * 1000)
}

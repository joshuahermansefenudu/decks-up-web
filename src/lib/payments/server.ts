import {
  BillingSubscriptionStatus,
  PlanType,
  Prisma,
  type BillingCheckoutKind,
  type CreditPackType,
} from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import {
  getRelayProfile,
  grantCreditPack,
} from "@/lib/relay/server-relay-pricing"
import { checkRateLimit } from "@/lib/sfu/server-rate-limit"
import {
  ensureStripeCustomer,
  getStripeServerClient,
  unixToDate,
} from "@/lib/stripe/server"
import {
  getCheckoutReturnUrl,
  getStripeCreditPackPriceId,
  getStripePlanPriceId,
  getStripePublishableKey,
  getPlanFromPriceId,
  type PaidPlanType,
} from "@/lib/stripe/prices"

const BANK_EXPIRY_DAYS = 90

const PLAN_MONTHLY_HOURS: Record<PaidPlanType, number> = {
  CORE: 5,
  PRO: 12,
}

const ACTIVE_SUBSCRIPTION_STATUSES: BillingSubscriptionStatus[] = [
  BillingSubscriptionStatus.ACTIVE,
  BillingSubscriptionStatus.TRIALING,
  BillingSubscriptionStatus.PAST_DUE,
  BillingSubscriptionStatus.INCOMPLETE,
]

type CreateCheckoutInput = {
  userId: string
  email?: string | null
  kind: BillingCheckoutKind
  planType?: PaidPlanType
  creditPack?: CreditPackType
  originContext?: string
  origin: string
  originPath?: string
}

type CheckoutSessionResult = {
  mode: "embedded"
  sessionId: string
  clientSecret: string
  publishableKey: string
} | {
  mode: "redirect"
  sessionId: string
  checkoutUrl: string
}

type SubscriptionSummary = {
  subscription: {
    stripeSubscriptionId: string
    stripePriceId: string
    planType: PlanType
    status: BillingSubscriptionStatus
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    isStripeManaged: boolean
  } | null
}

function logPaymentEvent(name: string, payload: Record<string, unknown>) {
  console.info("PAYMENT_EVENT", {
    name,
    timestampMs: Date.now(),
    payload,
  })
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function toOriginPath(input?: string) {
  if (!input) {
    return "/account?billing=success"
  }
  const trimmed = input.trim()
  if (!trimmed.startsWith("/")) {
    return "/account?billing=success"
  }
  return trimmed
}

function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): BillingSubscriptionStatus {
  switch (status) {
    case "active":
      return BillingSubscriptionStatus.ACTIVE
    case "trialing":
      return BillingSubscriptionStatus.TRIALING
    case "past_due":
      return BillingSubscriptionStatus.PAST_DUE
    case "unpaid":
      return BillingSubscriptionStatus.UNPAID
    case "canceled":
      return BillingSubscriptionStatus.CANCELED
    case "incomplete":
      return BillingSubscriptionStatus.INCOMPLETE
    case "incomplete_expired":
      return BillingSubscriptionStatus.INCOMPLETE_EXPIRED
    case "paused":
      return BillingSubscriptionStatus.PAUSED
    default:
      return BillingSubscriptionStatus.INCOMPLETE
  }
}

function getSubscriptionPeriodStart(subscription: Stripe.Subscription): Date | null {
  const raw = subscription as unknown as {
    current_period_start?: number
  }
  return unixToDate(raw.current_period_start ?? null)
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const raw = subscription as unknown as {
    current_period_end?: number
  }
  return unixToDate(raw.current_period_end ?? null)
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const direct = (invoice as unknown as { subscription?: unknown }).subscription
  if (typeof direct === "string") {
    return direct
  }

  const fromParent = (
    invoice as unknown as {
      parent?: {
        subscription_details?: {
          subscription?: string | null
        } | null
      } | null
    }
  ).parent?.subscription_details?.subscription

  return typeof fromParent === "string" ? fromParent : null
}

async function ensureRelayProfileRow(userId: string) {
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

function getSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null
}

async function resolveUserIdFromCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): Promise<string | null> {
  if (!customer) {
    return null
  }

  const customerId = typeof customer === "string" ? customer : customer.id

  const linked = await prisma.billingCustomer.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  })
  if (linked?.userId) {
    return linked.userId
  }

  let metadataUserId: string | undefined
  if (typeof customer === "string") {
    const stripe = getStripeServerClient()
    const fetched = await stripe.customers.retrieve(customer)
    if ("deleted" in fetched && fetched.deleted) {
      return null
    }
    metadataUserId = fetched.metadata?.userId
  } else if (!("deleted" in customer && customer.deleted)) {
    metadataUserId = customer.metadata?.userId
  }

  const userId = metadataUserId?.trim()
  if (!userId) {
    return null
  }

  await ensureRelayProfileRow(userId)
  await prisma.billingCustomer.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
    },
    update: {
      stripeCustomerId: customerId,
    },
  })

  return userId
}

async function upsertBillingSubscriptionSnapshot(input: {
  userId: string
  subscription: Stripe.Subscription
}) {
  const priceId = getSubscriptionPriceId(input.subscription)
  const planFromPrice = priceId ? getPlanFromPriceId(priceId) : null
  const nextPlanType: PlanType = planFromPrice?.planType ?? "FREE"
  const nextStatus = mapStripeSubscriptionStatus(input.subscription.status)

  const billingSubscription = await prisma.billingSubscription.upsert({
    where: {
      stripeSubscriptionId: input.subscription.id,
    },
    create: {
      userId: input.userId,
      stripeSubscriptionId: input.subscription.id,
      stripePriceId: priceId ?? "",
      planType: nextPlanType,
      status: nextStatus,
      currentPeriodStart: getSubscriptionPeriodStart(input.subscription),
      currentPeriodEnd: getSubscriptionPeriodEnd(input.subscription),
      cancelAtPeriodEnd: Boolean(input.subscription.cancel_at_period_end),
    },
    update: {
      userId: input.userId,
      stripePriceId: priceId ?? "",
      planType: nextPlanType,
      status: nextStatus,
      currentPeriodStart: getSubscriptionPeriodStart(input.subscription),
      currentPeriodEnd: getSubscriptionPeriodEnd(input.subscription),
      cancelAtPeriodEnd: Boolean(input.subscription.cancel_at_period_end),
    },
  })

  const nextMonthlyHours =
    nextPlanType === "CORE"
      ? PLAN_MONTHLY_HOURS.CORE
      : nextPlanType === "PRO"
        ? PLAN_MONTHLY_HOURS.PRO
        : 0

  await prisma.userRelayProfile.update({
    where: { userId: input.userId },
    data: {
      planType: nextPlanType,
      monthlyHours: nextMonthlyHours,
      isStripeManaged: nextPlanType !== "FREE",
      stripeSubscriptionStatus: nextStatus,
    },
  })

  return billingSubscription
}

async function markWebhookProcessed(eventId: string) {
  await prisma.stripeWebhookEvent.update({
    where: { eventId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      errorMessage: null,
    },
  })
}

async function markWebhookFailed(eventId: string, message: string) {
  await prisma.stripeWebhookEvent.update({
    where: { eventId },
    data: {
      status: "FAILED",
      errorMessage: message.slice(0, 2000),
    },
  })
}

async function beginWebhook(event: Stripe.Event): Promise<"process" | "skip"> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        status: "RECEIVED",
      },
    })
    return "process"
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.stripeWebhookEvent.findUnique({
        where: { eventId: event.id },
      })
      if (existing?.status === "PROCESSED") {
        return "skip"
      }
      await prisma.stripeWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          eventType: event.type,
          status: "RECEIVED",
          errorMessage: null,
        },
      })
      return "process"
    }
    throw error
  }
}

async function markCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<{
  userId: string | null
  kind: BillingCheckoutKind | null
  creditPack: CreditPackType | null
  alreadyCompleted: boolean
}> {
  const checkout = await prisma.billingCheckoutSession.findUnique({
    where: { stripeCheckoutSessionId: session.id },
  })

  if (!checkout) {
    const userIdFromMetadata = session.metadata?.userId?.trim() || null
    if (!userIdFromMetadata) {
      return {
        userId: null,
        kind: null,
        creditPack: null,
        alreadyCompleted: false,
      }
    }

    await ensureRelayProfileRow(userIdFromMetadata)
    await prisma.billingCheckoutSession.create({
      data: {
        stripeCheckoutSessionId: session.id,
        userId: userIdFromMetadata,
        kind:
          session.mode === "subscription"
            ? "SUBSCRIPTION"
            : "CREDIT_PACK",
        planType:
          session.metadata?.planType === "CORE" ||
          session.metadata?.planType === "PRO"
            ? session.metadata.planType
            : null,
        creditPack:
          session.metadata?.creditPack === "STARTER" ||
          session.metadata?.creditPack === "STANDARD" ||
          session.metadata?.creditPack === "PARTY"
            ? session.metadata.creditPack
            : null,
        status: "CREATED",
      },
    })

    return {
      userId: userIdFromMetadata,
      kind:
        session.mode === "subscription" ? "SUBSCRIPTION" : "CREDIT_PACK",
      creditPack:
        session.metadata?.creditPack === "STARTER" ||
        session.metadata?.creditPack === "STANDARD" ||
        session.metadata?.creditPack === "PARTY"
          ? session.metadata.creditPack
          : null,
      alreadyCompleted: false,
    }
  }

  if (checkout.status === "COMPLETED") {
    return {
      userId: checkout.userId,
      kind: checkout.kind,
      creditPack: checkout.creditPack,
      alreadyCompleted: true,
    }
  }

  return {
    userId: checkout.userId,
    kind: checkout.kind,
    creditPack: checkout.creditPack,
    alreadyCompleted: false,
  }
}

function monthlyHoursForPlan(planType: PlanType): number {
  if (planType === "CORE") {
    return PLAN_MONTHLY_HOURS.CORE
  }
  if (planType === "PRO") {
    return PLAN_MONTHLY_HOURS.PRO
  }
  return 0
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const completed = await markCheckoutSessionCompleted(session)
  const userId = completed.userId
  if (!userId) {
    return
  }
  if (completed.alreadyCompleted) {
    return
  }

  if (session.customer && typeof session.customer === "string") {
    await ensureRelayProfileRow(userId)
    await prisma.billingCustomer.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: session.customer,
      },
      update: {
        stripeCustomerId: session.customer,
      },
    })
  }

  if (completed.kind === "CREDIT_PACK" && completed.creditPack) {
    await grantCreditPack(userId, completed.creditPack)
    logPaymentEvent("credit_grant_applied", {
      userId,
      creditPack: completed.creditPack,
      source: "checkout.session.completed",
    })
  }

  await prisma.billingCheckoutSession.update({
    where: { stripeCheckoutSessionId: session.id },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
    },
  })

  logPaymentEvent("checkout_completed", {
    userId,
    sessionId: session.id,
    kind: completed.kind,
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return
  }

  let billingSubscription = await prisma.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  })

  if (!billingSubscription) {
    const stripe = getStripeServerClient()
    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
    const userId = await resolveUserIdFromCustomer(stripeSubscription.customer)
    if (!userId) {
      return
    }
    await ensureRelayProfileRow(userId)
    billingSubscription = await upsertBillingSubscriptionSnapshot({
      userId,
      subscription: stripeSubscription,
    })
  }

  const monthlyHours = monthlyHoursForPlan(billingSubscription.planType)
  if (monthlyHours <= 0) {
    return
  }

  const line = invoice.lines.data[0]
  const periodStart = unixToDate(line?.period?.start ?? null) ?? new Date()
  const periodEnd = unixToDate(line?.period?.end ?? null) ?? addDays(periodStart, 30)

  await prisma.relayHourBucket.create({
    data: {
      userId: billingSubscription.userId,
      source: "MONTHLY_GRANT",
      totalHours: monthlyHours,
      remainingHours: monthlyHours,
      expiresAt: addDays(periodEnd, BANK_EXPIRY_DAYS),
    },
  })

  await prisma.userRelayProfile.update({
    where: { userId: billingSubscription.userId },
    data: {
      planType: billingSubscription.planType,
      monthlyHours,
      isStripeManaged: true,
      stripeSubscriptionStatus: billingSubscription.status,
      lastRenewalDate: periodStart,
    },
  })

  await getRelayProfile(billingSubscription.userId)

  logPaymentEvent("credit_grant_applied", {
    userId: billingSubscription.userId,
    source: "invoice.paid",
    monthlyHours,
    stripeSubscriptionId: billingSubscription.stripeSubscriptionId,
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromCustomer(subscription.customer)
  if (!userId) {
    return
  }

  await ensureRelayProfileRow(userId)
  const updated = await upsertBillingSubscriptionSnapshot({
    userId,
    subscription,
  })

  logPaymentEvent("subscription_updated", {
    userId,
    subscriptionId: updated.stripeSubscriptionId,
    planType: updated.planType,
    status: updated.status,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromCustomer(subscription.customer)
  if (!userId) {
    return
  }

  await ensureRelayProfileRow(userId)
  const status = mapStripeSubscriptionStatus(subscription.status)

  await prisma.billingSubscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: getSubscriptionPriceId(subscription) ?? "",
      planType: "FREE",
      status,
      currentPeriodStart: getSubscriptionPeriodStart(subscription),
      currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
      cancelAtPeriodEnd: true,
    },
    update: {
      stripePriceId: getSubscriptionPriceId(subscription) ?? "",
      planType: "FREE",
      status,
      currentPeriodStart: getSubscriptionPeriodStart(subscription),
      currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
      cancelAtPeriodEnd: true,
    },
  })

  await prisma.userRelayProfile.update({
    where: { userId },
    data: {
      planType: "FREE",
      monthlyHours: 0,
      isStripeManaged: false,
      stripeSubscriptionStatus: BillingSubscriptionStatus.CANCELED,
    },
  })

  await getRelayProfile(userId)

  logPaymentEvent("subscription_deleted", {
    userId,
    subscriptionId: subscription.id,
  })
}

async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) {
    return
  }

  const billingSubscription = await prisma.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  })

  if (!billingSubscription) {
    return
  }

  if (billingSubscription.planType !== "CORE" && billingSubscription.planType !== "PRO") {
    return
  }

  const summary = await getRelayProfile(billingSubscription.userId)
  const nextPriceId = getStripePlanPriceId(billingSubscription.planType, {
    loyalty: summary.bankedHours > 0,
  })

  const stripe = getStripeServerClient()
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  const itemId = stripeSubscription.items.data[0]?.id
  const currentPriceId = stripeSubscription.items.data[0]?.price?.id

  if (!itemId || !currentPriceId || currentPriceId === nextPriceId) {
    return
  }

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: nextPriceId }],
    proration_behavior: "none",
  })

  await prisma.billingSubscription.update({
    where: { stripeSubscriptionId: subscriptionId },
    data: { stripePriceId: nextPriceId },
  })

  logPaymentEvent("subscription_loyalty_price_sync", {
    userId: billingSubscription.userId,
    subscriptionId,
    loyaltyApplied: summary.bankedHours > 0,
    previousPriceId: currentPriceId,
    nextPriceId,
  })
}

export async function processStripeWebhook(event: Stripe.Event) {
  const mode = await beginWebhook(event)
  if (mode === "skip") {
    return { duplicate: true }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      }
      case "invoice.paid": {
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      }
      case "invoice.upcoming": {
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice)
        break
      }
      default:
        break
    }

    await markWebhookProcessed(event.id)
    logPaymentEvent("webhook_processed", {
      eventId: event.id,
      eventType: event.type,
    })
    return { duplicate: false }
  } catch (error) {
    const message = String((error as Error | undefined)?.message ?? error)
    await markWebhookFailed(event.id, message)
    throw error
  }
}

export async function createCheckoutSessionForUser(
  input: CreateCheckoutInput
): Promise<CheckoutSessionResult> {
  await ensureRelayProfileRow(input.userId)
  const stripe = getStripeServerClient()
  const customer = await ensureStripeCustomer({
    userId: input.userId,
    email: input.email,
  })

  const returnUrl = getCheckoutReturnUrl(input.origin, toOriginPath(input.originPath))
  const useHostedCheckout = input.originContext === "pricing"
  const metadata: Record<string, string> = {
    userId: input.userId,
    kind: input.kind,
    originContext: input.originContext?.slice(0, 64) ?? "unknown",
  }

  const createSessionData: Stripe.Checkout.SessionCreateParams = {
    customer: customer.stripeCustomerId,
    client_reference_id: input.userId,
    metadata,
    allow_promotion_codes: true,
    ...(useHostedCheckout
      ? {
          success_url: returnUrl,
          cancel_url: returnUrl,
        }
      : {
          ui_mode: "embedded" as const,
          return_url: returnUrl,
        }),
  }

  if (input.kind === "SUBSCRIPTION") {
    if (!input.planType) {
      throw new Error("Missing plan type")
    }

    const activeSub = await prisma.billingSubscription.findFirst({
      where: {
        userId: input.userId,
        status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
      },
      orderBy: { updatedAt: "desc" },
    })

    if (activeSub) {
      throw new Error("subscription_exists")
    }

    const priceId = getStripePlanPriceId(input.planType, { loyalty: false })
    metadata.planType = input.planType

    const session = await stripe.checkout.sessions.create({
      ...createSessionData,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          userId: input.userId,
          planType: input.planType,
        },
      },
    })

    await prisma.billingCheckoutSession.create({
      data: {
        stripeCheckoutSessionId: session.id,
        userId: input.userId,
        kind: "SUBSCRIPTION",
        planType: input.planType,
        status: "CREATED",
      },
    })

    logPaymentEvent("checkout_created", {
      userId: input.userId,
      kind: "SUBSCRIPTION",
      planType: input.planType,
      sessionId: session.id,
      originContext: input.originContext ?? "unknown",
    })

    if (useHostedCheckout) {
      const checkoutUrl = session.url
      if (!checkoutUrl) {
        throw new Error("stripe_missing_checkout_url")
      }
      return {
        mode: "redirect",
        sessionId: session.id,
        checkoutUrl,
      }
    }

    const clientSecret = session.client_secret
    if (!clientSecret) {
      throw new Error("stripe_missing_client_secret")
    }

    const publishableKey = getStripePublishableKey()
    return {
      mode: "embedded",
      sessionId: session.id,
      clientSecret,
      publishableKey,
    }
  }

  if (!input.creditPack) {
    throw new Error("Missing credit pack")
  }

  const packPriceId = getStripeCreditPackPriceId(input.creditPack)
  metadata.creditPack = input.creditPack

  const paymentSession = await stripe.checkout.sessions.create({
    ...createSessionData,
    mode: "payment",
    line_items: [{ price: packPriceId, quantity: 1 }],
  })

  await prisma.billingCheckoutSession.create({
    data: {
      stripeCheckoutSessionId: paymentSession.id,
      userId: input.userId,
      kind: "CREDIT_PACK",
      creditPack: input.creditPack,
      status: "CREATED",
    },
  })

  logPaymentEvent("checkout_created", {
    userId: input.userId,
    kind: "CREDIT_PACK",
    creditPack: input.creditPack,
    sessionId: paymentSession.id,
    originContext: input.originContext ?? "unknown",
  })

  if (useHostedCheckout) {
    const checkoutUrl = paymentSession.url
    if (!checkoutUrl) {
      throw new Error("stripe_missing_checkout_url")
    }
    return {
      mode: "redirect",
      sessionId: paymentSession.id,
      checkoutUrl,
    }
  }

  const clientSecret = paymentSession.client_secret
  if (!clientSecret) {
    throw new Error("stripe_missing_client_secret")
  }

  const publishableKey = getStripePublishableKey()
  return {
    mode: "embedded",
    sessionId: paymentSession.id,
    clientSecret,
    publishableKey,
  }
}

export async function changeSubscriptionPlanForUser(input: {
  userId: string
  nextPlanType: PaidPlanType
}) {
  const stripe = getStripeServerClient()
  const activeSub = await prisma.billingSubscription.findFirst({
    where: {
      userId: input.userId,
      status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
  })

  if (!activeSub) {
    throw new Error("subscription_not_found")
  }

  const profile = await getRelayProfile(input.userId)
  const nextPriceId = getStripePlanPriceId(input.nextPlanType, {
    loyalty: profile.bankedHours > 0,
  })

  const stripeSubscription = await stripe.subscriptions.retrieve(
    activeSub.stripeSubscriptionId
  )
  const itemId = stripeSubscription.items.data[0]?.id
  if (!itemId) {
    throw new Error("subscription_item_missing")
  }

  const updated = await stripe.subscriptions.update(activeSub.stripeSubscriptionId, {
    items: [{ id: itemId, price: nextPriceId }],
    cancel_at_period_end: false,
    proration_behavior: "create_prorations",
  })

  const snapshot = await upsertBillingSubscriptionSnapshot({
    userId: input.userId,
    subscription: updated,
  })

  logPaymentEvent("plan_changed", {
    userId: input.userId,
    subscriptionId: snapshot.stripeSubscriptionId,
    nextPlanType: input.nextPlanType,
    nextPriceId,
  })

  return snapshot
}

export async function cancelSubscriptionForUser(userId: string) {
  const stripe = getStripeServerClient()
  const activeSub = await prisma.billingSubscription.findFirst({
    where: {
      userId,
      status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
  })

  if (!activeSub) {
    throw new Error("subscription_not_found")
  }

  const updated = await stripe.subscriptions.update(activeSub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  const snapshot = await upsertBillingSubscriptionSnapshot({
    userId,
    subscription: updated,
  })

  logPaymentEvent("cancel_requested", {
    userId,
    subscriptionId: snapshot.stripeSubscriptionId,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
  })

  return snapshot
}

export async function getSubscriptionSummaryForUser(
  userId: string
): Promise<SubscriptionSummary> {
  const latest = await prisma.billingSubscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  })

  if (!latest) {
    return { subscription: null }
  }

  return {
    subscription: {
      stripeSubscriptionId: latest.stripeSubscriptionId,
      stripePriceId: latest.stripePriceId,
      planType: latest.planType,
      status: latest.status,
      currentPeriodStart: latest.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: latest.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: latest.cancelAtPeriodEnd,
      isStripeManaged: latest.planType !== "FREE",
    },
  }
}

export async function getPurchaseTimelineForUser(userId: string) {
  const [checkouts, subscriptions] = await Promise.all([
    prisma.billingCheckoutSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.billingSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ])

  return {
    checkouts: checkouts.map((item) => ({
      id: item.id,
      kind: item.kind,
      planType: item.planType,
      creditPack: item.creditPack,
      status: item.status,
      processedAt: item.processedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    subscriptions: subscriptions.map((item) => ({
      id: item.id,
      stripeSubscriptionId: item.stripeSubscriptionId,
      planType: item.planType,
      status: item.status,
      cancelAtPeriodEnd: item.cancelAtPeriodEnd,
      currentPeriodStart: item.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: item.currentPeriodEnd?.toISOString() ?? null,
      updatedAt: item.updatedAt.toISOString(),
    })),
  }
}

export function checkCheckoutRateLimit(input: {
  userId: string
  ipAddress: string
}) {
  const byUser = checkRateLimit(`checkout:user:${input.userId}`, {
    maxHits: 10,
    windowMs: 60_000,
  })
  if (!byUser.ok) {
    return byUser
  }

  return checkRateLimit(`checkout:ip:${input.ipAddress}`, {
    maxHits: 20,
    windowMs: 60_000,
  })
}

export function normalizePriceSelectionError(error: unknown): string {
  const message = String((error as Error | undefined)?.message ?? error)
  if (message === "subscription_exists") {
    return "You already have an active subscription. Use change-plan instead."
  }
  if (message === "subscription_not_found") {
    return "No active subscription found for this account."
  }
  if (message === "subscription_item_missing") {
    return "Subscription update failed. Missing Stripe subscription item."
  }
  if (message.startsWith("Missing STRIPE_PRICE_")) {
    return "Stripe price IDs are not configured on the server."
  }
  if (message.includes("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")) {
    return "Stripe publishable key is not configured."
  }
  if (message === "stripe_missing_checkout_url") {
    return "Stripe checkout URL is unavailable for this purchase."
  }
  return message
}

export async function syncCheckoutSessionStatus(input: {
  userId: string
  sessionId: string
}) {
  const checkout = await prisma.billingCheckoutSession.findUnique({
    where: { stripeCheckoutSessionId: input.sessionId },
  })
  if (!checkout || checkout.userId !== input.userId) {
    return { status: "NOT_FOUND" as const }
  }

  if (checkout.status === "COMPLETED") {
    return { status: "COMPLETED" as const }
  }

  return { status: checkout.status }
}

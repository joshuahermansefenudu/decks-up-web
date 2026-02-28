"use client"

import Link from "next/link"
import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { HomeAccountEntry } from "@/components/layout/home-account-entry"
import { PricingCard } from "@/components/pricing/pricing-card"
import { Badge } from "@/components/ui/badge"
import { PrimaryButton } from "@/components/ui/primary-button"
import {
  createCheckoutSession,
  type PurchaseCreditPack,
  type PurchasePlanType,
} from "@/lib/payments/client"
import { supabaseBrowser } from "@/lib/supabase-browser"

const mainPlans = [
  {
    title: "Free - P2P Mode",
    price: "$0",
    features: [
      "Unlimited direct P2P video",
      "Join any room",
      "Request relay access from host",
      "Manual relay toggle (if host approves)",
      "No relay hours included",
    ],
    ctaLabel: "Play Free",
    ctaHref: "/",
    ctaVariant: "secondary" as const,
  },
  {
    title: "Core - Game Host",
    price: "$6.99/month",
    loyaltyPrice: "$4.99/month",
    features: [
      "5 relay hours per month",
      "Bank up to 15 hours (3 months max)",
      "Share relay hours with players in your game",
      "Approve/deny relay requests",
      "Relay auto-scales with room size",
      "Discounted renewal if hours are banked",
    ],
    ctaLabel: "Upgrade to Core",
    ctaVariant: "primary" as const,
    badge: "Most Popular",
    featured: true,
    loyaltyTooltip:
      "Loyalty pricing remains active until your banked hours reach zero.",
    planType: "CORE" as const,
  },
  {
    title: "Pro - Power Host",
    price: "$11.99/month",
    loyaltyPrice: "$8.99/month",
    features: [
      "12 relay hours per month",
      "Bank up to 36 hours",
      "Share relay hours",
      "Supports larger rooms",
      "Priority relay routing",
      "Lower overage rate",
      "Loyalty discount applies",
    ],
    ctaLabel: "Upgrade to Pro",
    ctaVariant: "primary" as const,
    planType: "PRO" as const,
  },
]

const creditPacks = [
  {
    title: "Starter Pack",
    price: "$3.49",
    features: ["3 Relay Hours", "Shareable in-game", "Expires in 3 months"],
    creditPack: "STARTER" as const,
  },
  {
    title: "Standard Pack",
    price: "$6.99",
    features: ["7 Relay Hours", "Shareable", "Expires in 3 months"],
    creditPack: "STANDARD" as const,
  },
  {
    title: "Party Pack",
    price: "$12.99",
    features: ["15 Relay Hours", "Shareable", "Expires in 3 months"],
    creditPack: "PARTY" as const,
  },
]

export default function PricingPage() {
  const [session, setSession] = React.useState<Session | null>(null)
  const [isStartingCheckout, setIsStartingCheckout] = React.useState(false)
  const [checkoutError, setCheckoutError] = React.useState("")
  const [subscriptionState, setSubscriptionState] = React.useState<
    "unknown" | "active" | "inactive"
  >("unknown")
  const accessToken = session?.access_token ?? ""
  const createGameHref = session
    ? "/create"
    : "/account/login?next=%2Fcreate"
  const isCheckingSubscription = Boolean(session) && subscriptionState === "unknown"
  const hasActiveSubscription = subscriptionState === "active"

  React.useEffect(() => {
    let mounted = true

    void supabaseBrowser.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) {
          return
        }
        setSession(data.session ?? null)
      })
      .catch(() => {
        if (!mounted) {
          return
        }
        setSession(null)
      })

    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
      }
    )

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    const checkSubscription = async () => {
      if (!accessToken) {
        setSubscriptionState("inactive")
        return
      }

      setSubscriptionState("unknown")

      try {
        const response = await fetch("/api/payments/subscription", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        })

        const payload = (await response.json().catch(() => ({}))) as {
          subscription?: { status?: string | null } | null
        }

        if (cancelled) {
          return
        }

        if (!response.ok || !payload.subscription) {
          setSubscriptionState("inactive")
          return
        }

        const status = (payload.subscription.status ?? "").toUpperCase()
        const active =
          status !== "CANCELED" &&
          status !== "UNPAID" &&
          status !== "INCOMPLETE_EXPIRED"

        setSubscriptionState(active ? "active" : "inactive")
      } catch {
        if (cancelled) {
          return
        }
        setSubscriptionState("inactive")
      }
    }

    void checkSubscription()

    return () => {
      cancelled = true
    }
  }, [accessToken])

  const startHostedCheckout = React.useCallback(
    async (input: { kind: "SUBSCRIPTION"; planType: PurchasePlanType } | { kind: "CREDIT_PACK"; creditPack: PurchaseCreditPack }) => {
      if (isStartingCheckout) {
        return
      }
      if (!session || !accessToken) {
        window.location.href = "/account/login?next=%2Fpricing"
        return
      }

      setIsStartingCheckout(true)
      setCheckoutError("")

      try {
        const result = await createCheckoutSession({
          accessToken,
          kind: input.kind,
          planType: input.kind === "SUBSCRIPTION" ? input.planType : undefined,
          creditPack: input.kind === "CREDIT_PACK" ? input.creditPack : undefined,
          originContext: "pricing",
          originPath: "/pricing?billing=success",
        })

        if (result.mode === "redirect") {
          window.location.href = result.checkoutUrl
          return
        }

        window.location.href =
          input.kind === "SUBSCRIPTION"
            ? `/account?purchase=plan&plan=${input.planType}`
            : `/account?purchase=pack&pack=${input.creditPack}`
      } catch (error) {
        setCheckoutError(String((error as Error | undefined)?.message ?? error))
      } finally {
        setIsStartingCheckout(false)
      }
    },
    [accessToken, isStartingCheckout, session]
  )

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-8">
      <div className="space-y-12">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge asChild className="w-fit">
                <Link href="/">Charades party game</Link>
              </Badge>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-full border-2 border-black bg-offwhite px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]"
              >
                Pricing
              </Link>
            </div>
            <HomeAccountEntry />
          </div>
        </header>

        <section className="rounded-3xl border-2 border-black bg-offwhite p-6 shadow-[8px_8px_0_#000] sm:p-8">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <h1 className="font-display text-4xl uppercase tracking-wide sm:text-5xl">
              Play Free. Upgrade When You Need Relay.
            </h1>
            <p className="text-base text-black/70 sm:text-lg">
              DecksUp runs on free direct P2P by default. Relay is optional and
              only used when direct connection fails.
            </p>
            <PrimaryButton asChild className="min-w-56">
              <Link href={createGameHref}>Start Playing Free</Link>
            </PrimaryButton>
            {!session ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                Purchases require login. Guest users can still play free P2P.
              </p>
            ) : null}
            {hasActiveSubscription ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                You already have a subscription. Paid plan buttons will open account
                management.
              </p>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
              Paid upgrades open secure Stripe checkout.
            </p>
            {checkoutError ? (
              <p className="rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-xs font-semibold text-black shadow-[2px_2px_0_#000]">
                {checkoutError}
              </p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="plans-heading" className="space-y-4">
          <h2
            id="plans-heading"
            className="font-display text-3xl uppercase tracking-wide"
          >
            Plans
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {mainPlans.map((plan) => {
              const paidPlanType = plan.planType
              const isPaidPlan = paidPlanType === "CORE" || paidPlanType === "PRO"

              return (
                <PricingCard
                  key={plan.title}
                  title={plan.title}
                  price={plan.price}
                  loyaltyPrice={plan.loyaltyPrice}
                  features={plan.features}
                  ctaLabel={
                    isPaidPlan && isCheckingSubscription
                      ? "Checking..."
                      : isPaidPlan && hasActiveSubscription
                        ? "Manage Subscription"
                        : isPaidPlan && isStartingCheckout
                          ? "Opening Stripe..."
                          : plan.ctaLabel
                  }
                  ctaHref={
                    isPaidPlan
                      ? hasActiveSubscription
                        ? "/account"
                        : undefined
                      : createGameHref
                  }
                  onCtaClick={
                    isPaidPlan && !hasActiveSubscription && !isCheckingSubscription
                      ? () => {
                          void startHostedCheckout({
                            kind: "SUBSCRIPTION",
                            planType: paidPlanType,
                          })
                        }
                      : undefined
                  }
                  ctaVariant={plan.ctaVariant}
                  badge={plan.badge}
                  featured={plan.featured}
                  loyaltyTooltip={plan.loyaltyTooltip}
                />
              )
            })}
          </div>
        </section>

        <section aria-labelledby="credit-packs-heading" className="space-y-4">
          <header className="space-y-2">
            <h2
              id="credit-packs-heading"
              className="font-display text-3xl uppercase tracking-wide"
            >
              Need Relay Without a Subscription?
            </h2>
            <p className="text-sm text-black/70">
              One-time packs for occasional games.
            </p>
          </header>

          <div className="grid gap-5 md:grid-cols-3">
            {creditPacks.map((pack) => (
              <PricingCard
                key={pack.title}
                title={pack.title}
                price={pack.price}
                features={pack.features}
                ctaLabel={isStartingCheckout ? "Opening Stripe..." : "Buy Credits"}
                onCtaClick={() => {
                  void startHostedCheckout({
                    kind: "CREDIT_PACK",
                    creditPack: pack.creditPack,
                  })
                }}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="relay-works-heading" className="space-y-4">
          <h2
            id="relay-works-heading"
            className="font-display text-3xl uppercase tracking-wide"
          >
            How Relay Works
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                Step 1
              </p>
              <h3 className="mt-1 font-display text-xl uppercase tracking-wide">
                Play in P2P mode (free)
              </h3>
            </article>
            <article className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                Step 2
              </p>
              <h3 className="mt-1 font-display text-xl uppercase tracking-wide">
                If direct connection fails, request relay access from a subscriber
                in the room
              </h3>
            </article>
            <article className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                Step 3
              </p>
              <h3 className="mt-1 font-display text-xl uppercase tracking-wide">
                Host approves - video continues using relay hours
              </h3>
            </article>
          </div>

          <p className="rounded-2xl border-2 border-black bg-lightgray px-4 py-3 text-sm text-black/80 shadow-[3px_3px_0_#000]">
            Relay hours are only used when direct connection fails.
          </p>
        </section>

        <section aria-labelledby="faq-heading" className="space-y-4">
          <h2
            id="faq-heading"
            className="font-display text-3xl uppercase tracking-wide"
          >
            FAQ
          </h2>

          <dl className="space-y-3">
            <div className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
              <dt className="font-display text-xl uppercase tracking-wide">
                Why isn't relay unlimited?
              </dt>
              <dd className="mt-2 text-sm text-black/70">
                Relay uses real server bandwidth. We keep P2P free and only charge
                when relay is required.
              </dd>
            </div>
            <div className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
              <dt className="font-display text-xl uppercase tracking-wide">
                What happens when my relay hours run out?
              </dt>
              <dd className="mt-2 text-sm text-black/70">
                Relay stops. You can upgrade or buy credits.
              </dd>
            </div>
            <div className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
              <dt className="font-display text-xl uppercase tracking-wide">
                Can I share hours with friends?
              </dt>
              <dd className="mt-2 text-sm text-black/70">
                Yes. Core, Pro, and Credit Pack users can approve relay access
                in-game.
              </dd>
            </div>
            <div className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
              <dt className="font-display text-xl uppercase tracking-wide">
                Do unused hours expire?
              </dt>
              <dd className="mt-2 text-sm text-black/70">
                Hours bank for up to 3 months.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  )
}

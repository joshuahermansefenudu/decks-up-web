"use client"

import * as React from "react"
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js"

import {
  cancelSubscription,
  changeSubscriptionPlan,
  createCheckoutSession,
  waitForWebhookEntitlements,
  type PurchaseCreditPack,
  type PurchasePlanType,
} from "@/lib/payments/client"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

type RelayPurchaseOverlayProps = {
  open: boolean
  originContext: "game" | "account" | "pricing"
  originPath?: string
  isAuthenticated: boolean
  accessToken?: string
  currentPlanType?: "FREE" | "CORE" | "PRO"
  hasActiveSubscription?: boolean
  initialSelection?: {
    kind: "SUBSCRIPTION" | "CREDIT_PACK"
    planType?: PurchasePlanType
    creditPack?: PurchaseCreditPack
  } | null
  onInitialSelectionConsumed?: () => void
  onClose: () => void
  onRequireSignIn?: () => void
  onCompleted?: () => Promise<void> | void
}

type OverlayView = "catalog" | "checkout"

const subscriptionOptions: Array<{
  planType: PurchasePlanType
  name: string
  price: string
  loyaltyPrice: string
  description: string
  details: string[]
}> = [
  {
    planType: "CORE",
    name: "Core",
    price: "$6.99/month",
    loyaltyPrice: "$4.99/month",
    description: "Best for regular hosts.",
    details: [
      "5 relay hours monthly",
      "Bank up to 15 hours",
      "Share relay hours in-game",
    ],
  },
  {
    planType: "PRO",
    name: "Pro",
    price: "$11.99/month",
    loyaltyPrice: "$8.99/month",
    description: "For bigger and longer game sessions.",
    details: [
      "12 relay hours monthly",
      "Bank up to 36 hours",
      "Lower overage rate",
    ],
  },
]

const relayPackOptions: Array<{
  creditPack: PurchaseCreditPack
  name: string
  price: string
  hours: string
}> = [
  {
    creditPack: "STARTER",
    name: "Starter Pack",
    price: "$3.49",
    hours: "3 relay hours (3 months)",
  },
  {
    creditPack: "STANDARD",
    name: "Standard Pack",
    price: "$6.99",
    hours: "7 relay hours (3 months)",
  },
  {
    creditPack: "PARTY",
    name: "Party Pack",
    price: "$12.99",
    hours: "15 relay hours (3 months)",
  },
]

type CheckoutPayload = {
  sessionId: string
  clientSecret: string
  publishableKey: string
}

function RelayPurchaseOverlay({
  open,
  originContext,
  originPath,
  isAuthenticated,
  accessToken,
  currentPlanType,
  hasActiveSubscription,
  initialSelection,
  onInitialSelectionConsumed,
  onClose,
  onRequireSignIn,
  onCompleted,
}: RelayPurchaseOverlayProps) {
  const checkoutContainerRef = React.useRef<HTMLDivElement | null>(null)
  const embeddedCheckoutRef = React.useRef<StripeEmbeddedCheckout | null>(null)
  const [view, setView] = React.useState<OverlayView>("catalog")
  const [checkoutPayload, setCheckoutPayload] = React.useState<CheckoutPayload | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isWaitingForWebhook, setIsWaitingForWebhook] = React.useState(false)
  const [error, setError] = React.useState("")
  const [successMessage, setSuccessMessage] = React.useState("")
  const autoSelectionKeyRef = React.useRef("")

  const token = accessToken ?? ""

  const resetState = React.useCallback(() => {
    setView("catalog")
    setCheckoutPayload(null)
    setIsSubmitting(false)
    setIsWaitingForWebhook(false)
    setError("")
    setSuccessMessage("")
  }, [])

  React.useEffect(() => {
    if (!open) {
      resetState()
      autoSelectionKeyRef.current = ""
      if (embeddedCheckoutRef.current) {
        embeddedCheckoutRef.current.destroy()
        embeddedCheckoutRef.current = null
      }
    }
  }, [open, resetState])

  const completePurchase = React.useCallback(
    async (sessionId: string) => {
      if (!token) {
        return
      }
      setIsWaitingForWebhook(true)
      const result = await waitForWebhookEntitlements({
        accessToken: token,
        sessionId,
        timeoutMs: 30_000,
        pollIntervalMs: 1500,
      })

      if (result.completed) {
        setSuccessMessage("Purchase complete. Relay hours updated.")
        await onCompleted?.()
        setTimeout(() => {
          onClose()
        }, 500)
      } else {
        setError(
          "Payment succeeded, but webhook sync is still processing. Refresh in a few seconds."
        )
      }
      setIsWaitingForWebhook(false)
    },
    [onClose, onCompleted, token]
  )

  React.useEffect(() => {
    if (!open || view !== "checkout" || !checkoutPayload || !checkoutContainerRef.current) {
      return
    }

    let cancelled = false

    const mountCheckout = async () => {
      try {
        const stripe = await loadStripe(checkoutPayload.publishableKey)
        if (!stripe || cancelled) {
          return
        }

        const embeddedCheckout = await stripe.initEmbeddedCheckout({
          fetchClientSecret: async () => checkoutPayload.clientSecret,
          onComplete: () => {
            void completePurchase(checkoutPayload.sessionId)
          },
        })

        if (cancelled || !checkoutContainerRef.current) {
          embeddedCheckout.destroy()
          return
        }

        embeddedCheckout.mount(checkoutContainerRef.current)
        embeddedCheckoutRef.current = embeddedCheckout
      } catch (checkoutError) {
        if (cancelled) {
          return
        }
        setError(
          String((checkoutError as Error | undefined)?.message ?? checkoutError)
        )
        setView("catalog")
      }
    }

    void mountCheckout()

    return () => {
      cancelled = true
      if (embeddedCheckoutRef.current) {
        embeddedCheckoutRef.current.destroy()
        embeddedCheckoutRef.current = null
      }
    }
  }, [checkoutPayload, completePurchase, open, view])

  const openEmbeddedCheckout = React.useCallback(
    async (input: {
      kind: "SUBSCRIPTION" | "CREDIT_PACK"
      planType?: PurchasePlanType
      creditPack?: PurchaseCreditPack
    }) => {
      if (!token) {
        setError("Sign in is required to subscribe or buy relay hours.")
        onRequireSignIn?.()
        return
      }

      setError("")
      setSuccessMessage("")
      setIsSubmitting(true)

      try {
        const session = await createCheckoutSession({
          accessToken: token,
          kind: input.kind,
          planType: input.planType,
          creditPack: input.creditPack,
          originContext,
          originPath,
        })
        if (session.mode === "redirect") {
          window.location.href = session.checkoutUrl
          return
        }
        setCheckoutPayload(session)
        setView("checkout")
      } catch (sessionError) {
        setError(String((sessionError as Error | undefined)?.message ?? sessionError))
      } finally {
        setIsSubmitting(false)
      }
    },
    [onRequireSignIn, originContext, originPath, token]
  )

  const handleChoosePlan = React.useCallback(
    async (planType: PurchasePlanType) => {
      if (!token) {
        setError("Sign in is required to subscribe or buy relay hours.")
        onRequireSignIn?.()
        return
      }

      setError("")
      setSuccessMessage("")
      setIsSubmitting(true)

      try {
        if (hasActiveSubscription) {
          await changeSubscriptionPlan({ accessToken: token, planType })
          setSuccessMessage("Plan updated with Stripe proration.")
          await onCompleted?.()
          return
        }

        await openEmbeddedCheckout({
          kind: "SUBSCRIPTION",
          planType,
        })
      } catch (planError) {
        setError(String((planError as Error | undefined)?.message ?? planError))
      } finally {
        setIsSubmitting(false)
      }
    },
    [hasActiveSubscription, onCompleted, onRequireSignIn, openEmbeddedCheckout, token]
  )

  const handleCancelAtPeriodEnd = React.useCallback(async () => {
    if (!token) {
      return
    }

    setError("")
    setSuccessMessage("")
    setIsSubmitting(true)

    try {
      await cancelSubscription(token)
      setSuccessMessage("Subscription set to end at period end.")
      await onCompleted?.()
    } catch (cancelError) {
      setError(String((cancelError as Error | undefined)?.message ?? cancelError))
    } finally {
      setIsSubmitting(false)
    }
  }, [onCompleted, token])

  React.useEffect(() => {
    if (
      !open ||
      !isAuthenticated ||
      !initialSelection ||
      view !== "catalog" ||
      isSubmitting ||
      isWaitingForWebhook ||
      checkoutPayload
    ) {
      return
    }

    const selectionKey = JSON.stringify(initialSelection)
    if (autoSelectionKeyRef.current === selectionKey) {
      return
    }
    autoSelectionKeyRef.current = selectionKey
    onInitialSelectionConsumed?.()

    if (
      initialSelection.kind === "CREDIT_PACK" &&
      initialSelection.creditPack
    ) {
      void openEmbeddedCheckout({
        kind: "CREDIT_PACK",
        creditPack: initialSelection.creditPack,
      })
      return
    }

    if (
      initialSelection.kind === "SUBSCRIPTION" &&
      initialSelection.planType
    ) {
      void handleChoosePlan(initialSelection.planType)
    }
  }, [
    checkoutPayload,
    handleChoosePlan,
    initialSelection,
    isAuthenticated,
    isSubmitting,
    isWaitingForWebhook,
    onInitialSelectionConsumed,
    open,
    openEmbeddedCheckout,
    view,
  ])

  if (!open) {
    return null
  }

  const showCancelButton = Boolean(hasActiveSubscription)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-2xl rounded-3xl border-2 border-black bg-offwhite p-5 shadow-[6px_6px_0_#000]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl uppercase tracking-wide text-black">
              Relay Access
            </h2>
            <p className="mt-1 text-sm text-black/80">
              Subscribe or buy relay hours without leaving this screen.
            </p>
          </div>
          <SecondaryButton
            type="button"
            className="px-4 py-2 text-xs"
            onClick={() => {
              onClose()
            }}
          >
            Close
          </SecondaryButton>
        </div>

        {!isAuthenticated ? (
          <div className="mt-4 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 text-sm font-semibold text-black shadow-[3px_3px_0_#000]">
            Sign in is required to subscribe or buy relay hours.
          </div>
        ) : view === "checkout" ? (
          <div className="mt-4 rounded-2xl border-2 border-black bg-lightgray p-3 shadow-[3px_3px_0_#000]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/70">
              Secure Stripe Checkout
            </p>
            <div ref={checkoutContainerRef} className="min-h-[420px]" />
            {isWaitingForWebhook ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-black/70">
                Finalizing purchase and syncing relay entitlements...
              </p>
            ) : null}
            <div className="mt-3">
              <SecondaryButton
                type="button"
                className="px-4 py-2 text-xs"
                onClick={() => {
                  setView("catalog")
                  if (embeddedCheckoutRef.current) {
                    embeddedCheckoutRef.current.destroy()
                    embeddedCheckoutRef.current = null
                  }
                }}
              >
                Back
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-2xl border-2 border-black bg-lightgray p-4 shadow-[3px_3px_0_#000]">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
                Subscription Plans
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {subscriptionOptions.map((plan) => (
                  <div
                    key={plan.planType}
                    className="rounded-2xl border-2 border-black bg-offwhite p-3 shadow-[2px_2px_0_#000]"
                  >
                    <p className="font-display text-lg uppercase tracking-wide text-black">
                      {plan.name}
                    </p>
                    <p className="text-sm font-semibold text-black">{plan.price}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-black/60">
                      Loyalty: {plan.loyaltyPrice}
                    </p>
                    <p className="mt-2 text-xs text-black/75">{plan.description}</p>
                    <ul className="mt-2 space-y-1 text-[11px] font-semibold uppercase tracking-wide text-black/70">
                      {plan.details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                    <PrimaryButton
                      type="button"
                      className="mt-3 w-full py-2 text-xs"
                      disabled={isSubmitting || currentPlanType === plan.planType}
                      onClick={() => {
                        void handleChoosePlan(plan.planType)
                      }}
                    >
                      {currentPlanType === plan.planType
                        ? `${plan.name} active`
                        : hasActiveSubscription
                          ? `Switch to ${plan.name}`
                          : `Choose ${plan.name}`}
                    </PrimaryButton>
                  </div>
                ))}
              </div>
              {showCancelButton ? (
                <div className="mt-4 border-t-2 border-black/20 pt-4">
                  <SecondaryButton
                    type="button"
                    className="w-full"
                    disabled={isSubmitting}
                    onClick={() => {
                      void handleCancelAtPeriodEnd()
                    }}
                  >
                    Cancel at Period End
                  </SecondaryButton>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border-2 border-black bg-lightgray p-4 shadow-[3px_3px_0_#000]">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
                One-Time Relay Packs
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {relayPackOptions.map((pack) => (
                  <div
                    key={pack.creditPack}
                    className="rounded-2xl border-2 border-black bg-offwhite p-3 shadow-[2px_2px_0_#000]"
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide text-black">
                      {pack.name}
                    </p>
                    <p className="mt-1 text-lg font-bold text-black">{pack.price}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-black/70">
                      {pack.hours}
                    </p>
                    <PrimaryButton
                      type="button"
                      className="mt-3 w-full py-2 text-xs"
                      disabled={isSubmitting}
                      onClick={() => {
                        void openEmbeddedCheckout({
                          kind: "CREDIT_PACK",
                          creditPack: pack.creditPack,
                        })
                      }}
                    >
                      Buy
                    </PrimaryButton>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {isSubmitting ? (
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-black/70">
            Processing...
          </p>
        ) : null}
        {successMessage ? (
          <p className="mt-3 rounded-xl border-2 border-black bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]">
            {successMessage}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-xs font-semibold text-black shadow-[2px_2px_0_#000]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { RelayPurchaseOverlay }

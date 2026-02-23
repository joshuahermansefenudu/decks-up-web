"use client"

import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

type RelayPurchaseModalProps = {
  open: boolean
  isAuthenticated: boolean
  isSubmitting: boolean
  error: string
  successMessage: string
  onClose: () => void
  onBuyPlan: (planType: "CORE" | "PRO") => void
  onBuyPack: (creditPack: "STARTER" | "STANDARD" | "PARTY") => void
}

const subscriptionOptions: Array<{
  planType: "CORE" | "PRO"
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
      "Share hours in-game",
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
  creditPack: "STARTER" | "STANDARD" | "PARTY"
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

function RelayPurchaseModal({
  open,
  isAuthenticated,
  isSubmitting,
  error,
  successMessage,
  onClose,
  onBuyPlan,
  onBuyPack,
}: RelayPurchaseModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-xl rounded-3xl border-2 border-black bg-offwhite p-5 shadow-[6px_6px_0_#000]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl uppercase tracking-wide text-black">
              Relay Access
            </h2>
            <p className="mt-1 text-sm text-black/80">
              Subscribe or buy relay hours without leaving this game.
            </p>
          </div>
          <SecondaryButton type="button" className="px-4 py-2 text-xs" onClick={onClose}>
            Close
          </SecondaryButton>
        </div>

        {!isAuthenticated ? (
          <div className="mt-4 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 text-sm font-semibold text-black shadow-[3px_3px_0_#000]">
            Sign in is required to subscribe or buy relay hours.
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
                      disabled={isSubmitting}
                      onClick={() => onBuyPlan(plan.planType)}
                    >
                      Choose {plan.name}
                    </PrimaryButton>
                  </div>
                ))}
              </div>
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
                      onClick={() => onBuyPack(pack.creditPack)}
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

export { RelayPurchaseModal }

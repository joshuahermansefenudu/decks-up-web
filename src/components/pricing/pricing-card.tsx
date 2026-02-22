import Link from "next/link"

import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"
import { cn } from "@/lib/utils"

type PricingCardProps = {
  title: string
  subtitle?: string
  price: string
  loyaltyPrice?: string
  features: string[]
  ctaLabel: string
  ctaHref: string
  ctaVariant?: "primary" | "secondary"
  badge?: string
  featured?: boolean
  loyaltyTooltip?: string
}

function PricingCard({
  title,
  subtitle,
  price,
  loyaltyPrice,
  features,
  ctaLabel,
  ctaHref,
  ctaVariant = "primary",
  badge,
  featured = false,
  loyaltyTooltip,
}: PricingCardProps) {
  const CtaButton = ctaVariant === "secondary" ? SecondaryButton : PrimaryButton

  return (
    <article
      className={cn(
        "relative flex h-full flex-col gap-4 rounded-3xl border-2 border-black bg-offwhite p-5 shadow-[6px_6px_0_#000] transition-all duration-200 hover:-translate-y-1 hover:shadow-[10px_10px_0_#000]",
        featured && "bg-primary/20 ring-2 ring-black/10"
      )}
    >
      {badge ? (
        <div className="absolute -top-3 left-4 rounded-full border-2 border-black bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide shadow-[2px_2px_0_#000]">
          {badge}
        </div>
      ) : null}

      <header className="space-y-2">
        <h2 className="font-display text-2xl uppercase tracking-wide">{title}</h2>
        {subtitle ? <p className="text-sm text-black/70">{subtitle}</p> : null}

        <div className="space-y-1 rounded-2xl border-2 border-black bg-lightgray px-3 py-2">
          <p className="text-3xl font-bold tracking-tight text-black">{price}</p>
          {loyaltyPrice ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-black/80">
              Loyalty: {loyaltyPrice}
              {loyaltyTooltip ? (
                <abbr
                  title={loyaltyTooltip}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-offwhite text-[10px] no-underline"
                >
                  i
                </abbr>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>

      <ul className="space-y-2 text-sm text-black/80">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 h-2 w-2 rounded-full border border-black bg-primary"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        <CtaButton asChild className="w-full">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </CtaButton>
      </div>
    </article>
  )
}

export { PricingCard }


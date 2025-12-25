"use client"

import * as React from "react"

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true"

type AdSlotProps = {
  slot: string
  className?: string
  format?: string
}

export default function AdSlot({
  slot,
  className,
  format = "auto",
}: AdSlotProps) {
  if (!ADSENSE_ENABLED || !ADSENSE_CLIENT || !slot) {
    return null
  }

  React.useEffect(() => {
    try {
      if (typeof window === "undefined") {
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).adsbygoogle.push({})
    } catch {
      // Ignore AdSense init errors to avoid breaking UI.
    }
  }, [])

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`.trim()}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  )
}

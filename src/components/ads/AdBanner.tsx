"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT

function AdBanner() {
  const pathname = usePathname()

  if (pathname?.startsWith("/game")) {
    return null
  }

  if (process.env.NODE_ENV !== "production") {
    return null
  }

  if (!ADSENSE_CLIENT || !ADSENSE_SLOT) {
    // TODO: Set NEXT_PUBLIC_ADSENSE_CLIENT and NEXT_PUBLIC_ADSENSE_SLOT in production.
    return null
  }

  React.useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).adsbygoogle.push({})
    } catch {
      // Ignore AdSense init errors to avoid breaking UI.
    }
  }, [])

  return (
    <div className="w-full px-4 pb-2 pt-2">
      <div className="mx-auto w-full max-w-md">
        <ins
          className="adsbygoogle block w-full"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  )
}

export { AdBanner }

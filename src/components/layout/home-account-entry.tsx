"use client"

import Link from "next/link"
import * as React from "react"
import type { Session } from "@supabase/supabase-js"
import { CircleUserRound } from "lucide-react"

import { supabaseBrowser } from "@/lib/supabase-browser"

export function HomeAccountEntry() {
  const [session, setSession] = React.useState<Session | null>(null)
  const [isChecked, setIsChecked] = React.useState(false)

  React.useEffect(() => {
    let isMounted = true

    const init = async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (!isMounted) {
        return
      }
      setSession(data.session ?? null)
      setIsChecked(true)
    }

    void init()

    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession)
        setIsChecked(true)
      }
    )

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const showSignupText = isChecked && !session

  return (
    <Link
      href="/account"
      aria-label="Open account"
      className={`inline-flex h-11 items-center rounded-full border-2 border-black bg-offwhite text-black shadow-[3px_3px_0_#000] transition-transform hover:-translate-y-0.5 active:translate-y-0 ${
        showSignupText ? "gap-2 px-3" : "w-11 justify-center"
      }`}
    >
      <CircleUserRound className="h-5 w-5" />
      {showSignupText ? (
        <span className="text-xs font-semibold uppercase tracking-wide">
          Sign Up
        </span>
      ) : null}
      <span className="sr-only">Account</span>
    </Link>
  )
}

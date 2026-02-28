"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"
import { HomeAccountEntry } from "@/components/layout/home-account-entry"
import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function PlayAccessPage() {
  const router = useRouter()
  const [session, setSession] = React.useState<Session | null>(null)
  const [isCheckingSession, setIsCheckingSession] = React.useState(true)
  const [sessionCheckError, setSessionCheckError] = React.useState("")
  const [authActionError, setAuthActionError] = React.useState("")
  const [isGoogleSigningIn, setIsGoogleSigningIn] = React.useState(false)
  const [nextPath, setNextPath] = React.useState<"/create" | "/join">("/create")

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    setNextPath(next === "join" ? "/join" : "/create")

    let isMounted = true

    const getSessionWithTimeout = async (timeoutMs: number) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                "Account check is unavailable right now. You can continue as a guest."
              )
            )
          }, timeoutMs)
        })

        return (await Promise.race([
          supabaseBrowser.auth.getSession(),
          timeoutPromise,
        ])) as Awaited<ReturnType<typeof supabaseBrowser.auth.getSession>>
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }

    const init = async () => {
      try {
        const { data, error } = await getSessionWithTimeout(4500)

        if (!isMounted) {
          return
        }

        if (error) {
          setSession(null)
          setSessionCheckError(error.message)
          return
        }

        setSession(data.session ?? null)
        setSessionCheckError("")
      } catch (error) {
        if (!isMounted) {
          return
        }

        setSession(null)
        setSessionCheckError(String((error as Error)?.message ?? error))
      } finally {
        if (isMounted) {
          setIsCheckingSession(false)
        }
      }
    }

    void init()

    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession)
        setSessionCheckError("")
        setIsCheckingSession(false)
      }
    )

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const nextLabel = nextPath === "/join" ? "Join Game" : "Create Game"
  const isLoggedIn = Boolean(session)

  React.useEffect(() => {
    if (isCheckingSession || !isLoggedIn) {
      return
    }

    router.replace(nextPath)
  }, [isCheckingSession, isLoggedIn, nextPath, router])

  const handleGoogleSignUp = async () => {
    if (isGoogleSigningIn) {
      return
    }

    setAuthActionError("")
    setIsGoogleSigningIn(true)

    try {
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${nextPath}`,
        },
      })

      if (error) {
        setAuthActionError(`GOOGLE_SIGNUP_ERROR | detail=${error.message}`)
      }
    } catch (error) {
      setAuthActionError(
        `GOOGLE_SIGNUP_ERROR | detail=${String((error as Error)?.message ?? error)}`
      )
    } finally {
      setIsGoogleSigningIn(false)
    }
  }

  return (
    <PageContainer>
      <Stack className="gap-6">
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

        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Continue to {nextLabel}
          </h1>
          <p className="text-sm text-black/70">
            {isLoggedIn
              ? "You are signed in. Continue with your account features enabled."
              : "Play instantly as a guest, or sign in to unlock saved photo features."}
          </p>
        </header>

        {isCheckingSession ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
            Checking account status...
          </p>
        ) : null}

        {!isCheckingSession && sessionCheckError ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
            {sessionCheckError}
          </p>
        ) : null}

        {!isCheckingSession && isLoggedIn ? (
          <Card>
            <CardHeader>
              <CardTitle>Redirecting...</CardTitle>
              <CardDescription>
                Taking you straight to {nextLabel}.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!isLoggedIn ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>
                Create an account to save photos and use them in future games.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <GoogleOAuthButton
                onClick={handleGoogleSignUp}
                disabled={isGoogleSigningIn}
                isLoading={isGoogleSigningIn}
              >
                Sign up with Google
              </GoogleOAuthButton>
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-black/50">
                Or
              </p>
              <SecondaryButton asChild className="w-full">
                <Link href={`/account/signup?next=${encodeURIComponent(nextPath)}`}>
                  Create Account
                </Link>
              </SecondaryButton>
              {authActionError ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                  {authActionError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!isLoggedIn ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign in or continue as guest</CardTitle>
              <CardDescription>
                Already have an account? Sign in. Otherwise, keep playing as a
                guest.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <PrimaryButton asChild className="w-full">
                <Link href={`/account/login?next=${encodeURIComponent(nextPath)}`}>
                  Sign In
                </Link>
              </PrimaryButton>
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-black/50">
                Or
              </p>
              <Link
                href={nextPath}
                className="inline-flex w-full items-center justify-center rounded-full border-2 border-black bg-white px-6 py-3 text-base font-semibold uppercase tracking-wide text-black shadow-[4px_4px_0_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
              >
                Continue as Guest
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </PageContainer>
  )
}

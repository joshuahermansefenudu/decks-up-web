"use client"

import Link from "next/link"
import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"
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
  const [session, setSession] = React.useState<Session | null>(null)
  const [isCheckingSession, setIsCheckingSession] = React.useState(true)
  const [sessionCheckError, setSessionCheckError] = React.useState("")
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

  return (
    <PageContainer>
      <Stack className="gap-6">
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

        {!isLoggedIn ? (
          <Card>
            <CardHeader>
              <CardTitle>Continue as guest</CardTitle>
              <CardDescription>
                No account needed. You can still create or join any lobby.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PrimaryButton asChild className="w-full">
                <Link href={nextPath}>Continue as Guest</Link>
              </PrimaryButton>
            </CardContent>
          </Card>
        ) : null}

        {isLoggedIn ? (
          <Card>
            <CardHeader>
              <CardTitle>Continue as signed-in user</CardTitle>
              <CardDescription>
                Use your saved photo library while creating or joining games.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <PrimaryButton asChild className="w-full">
                <Link href={nextPath}>Continue to {nextLabel}</Link>
              </PrimaryButton>
              <SecondaryButton asChild className="w-full">
                <Link href={`/account?next=${encodeURIComponent(nextPath)}`}>
                  Manage Account
                </Link>
              </SecondaryButton>
            </CardContent>
          </Card>
        ) : null}

        {!isLoggedIn ? (
          <Card>
            <CardHeader>
              <CardTitle>Login or create account</CardTitle>
              <CardDescription>
                Account benefits: save photos once, reuse them in future games, and
                manage your library anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <PrimaryButton asChild className="w-full">
                <Link href={`/account/login?next=${encodeURIComponent(nextPath)}`}>
                  Login
                </Link>
              </PrimaryButton>
              <SecondaryButton asChild className="w-full">
                <Link href={`/account/signup?next=${encodeURIComponent(nextPath)}`}>
                  Create Account
                </Link>
              </SecondaryButton>
            </CardContent>
          </Card>
        ) : null}

        <SecondaryButton asChild className="w-full">
          <Link href="/">Back Home</Link>
        </SecondaryButton>
      </Stack>
    </PageContainer>
  )
}

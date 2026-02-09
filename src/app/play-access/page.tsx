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
  const [isSessionLoading, setIsSessionLoading] = React.useState(true)
  const [nextPath, setNextPath] = React.useState<"/create" | "/join">("/create")

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    setNextPath(next === "join" ? "/join" : "/create")

    let isMounted = true

    const init = async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (!isMounted) {
        return
      }
      setSession(data.session ?? null)
      setIsSessionLoading(false)
    }

    void init()

    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession)
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

        {isSessionLoading ? (
          <Card>
            <CardContent className="py-6 text-sm text-black/70">
              Checking account status...
            </CardContent>
          </Card>
        ) : null}

        {!isSessionLoading && !isLoggedIn ? (
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

        {!isSessionLoading && isLoggedIn ? (
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

        {!isSessionLoading && !isLoggedIn ? (
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

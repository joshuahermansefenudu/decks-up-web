"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
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

export default function DeleteAccountPage() {
  const router = useRouter()
  const [session, setSession] = React.useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = React.useState(true)
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
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

  const handleDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!password.trim()) {
      setError("Enter your password to confirm account deletion.")
      return
    }

    if (!session?.user?.email) {
      setError("You are signed out. Login and try again.")
      return
    }

    setIsSubmitting(true)

    try {
      const { error: verifyError } = await supabaseBrowser.auth.signInWithPassword(
        {
          email: session.user.email,
          password,
        }
      )
      if (verifyError) {
        setError("Password confirmation failed.")
        return
      }

      const { data } = await supabaseBrowser.auth.getSession()
      const token = data.session?.access_token ?? ""
      if (!token) {
        setError("Missing session token. Login again.")
        return
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload?.error ?? "Unable to delete account.")
        return
      }

      await supabaseBrowser.auth.signOut()
      router.push("/")
    } catch {
      setError("Unable to delete account.")
    } finally {
      setIsSubmitting(false)
      setPassword("")
    }
  }

  return (
    <PageContainer>
      <Stack className="gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Delete Account
          </h1>
          <p className="text-sm text-black/70">
            Permanently delete your account.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>
              Warning: your saved pictures will be permanently deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSessionLoading ? (
              <p className="text-sm text-black/70">Checking session...</p>
            ) : !session ? (
              <p className="text-sm text-black/70">
                You are signed out. Login first to delete your account.
              </p>
            ) : (
              <form className="space-y-3" onSubmit={handleDelete}>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  Confirm password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                  />
                </label>
                <SecondaryButton type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Deleting..." : "Delete Account"}
                </SecondaryButton>
              </form>
            )}

            {error ? <p className="text-sm font-semibold text-black">{error}</p> : null}
          </CardContent>
        </Card>

        <PrimaryButton asChild className="w-full">
          <Link href="/account">Back to Account</Link>
        </PrimaryButton>
      </Stack>
    </PageContainer>
  )
}

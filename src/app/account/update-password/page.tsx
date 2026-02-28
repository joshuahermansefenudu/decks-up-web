"use client"

import Link from "next/link"
import * as React from "react"
import type { Session } from "@supabase/supabase-js"

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
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function UpdatePasswordPage() {
  const [session, setSession] = React.useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = React.useState(true)
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (
      !currentPassword.trim() ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {
      setError("Enter current password, new password, and confirm password.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (!session?.user?.email) {
      setError("Account email is missing. Sign in again and retry.")
      return
    }

    setIsSubmitting(true)

    try {
      const { error: verifyError } = await supabaseBrowser.auth.signInWithPassword(
        {
          email: session.user.email,
          password: currentPassword,
        }
      )
      if (verifyError) {
        setError("Current password is incorrect.")
        return
      }

      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        setError(updateError.message)
        return
      }

      setMessage("Password updated successfully.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setError("Unable to update password.")
    } finally {
      setIsSubmitting(false)
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
            Update Password
          </h1>
          <p className="text-sm text-black/70">
            Change your account password.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Password settings</CardTitle>
            <CardDescription>
              You must be logged in to update your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSessionLoading ? (
              <p className="text-sm text-black/70">Checking session...</p>
            ) : !session ? (
              <p className="text-sm text-black/70">
                You are signed out. Login first to update password.
              </p>
            ) : (
              <form className="space-y-3" onSubmit={handleSubmit}>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  Current password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                  />
                </label>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  New password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                  />
                </label>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                  />
                </label>
                <PrimaryButton type="submit" disabled={isSubmitting} className="mt-3">
                  {isSubmitting ? "Updating..." : "Update Password"}
                </PrimaryButton>
              </form>
            )}

            {error ? <p className="text-sm font-semibold text-black">{error}</p> : null}
            {message ? <p className="text-sm text-black/70">{message}</p> : null}
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  )
}

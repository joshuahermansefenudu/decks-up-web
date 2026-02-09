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

export default function ResetPasswordPage() {
  const [session, setSession] = React.useState<Session | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [password, setPassword] = React.useState("")
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
      setIsLoading(false)
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

  const handleUpdatePassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Enter and confirm your new password.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setMessage("Password updated. You can now log in with the new password.")
      setPassword("")
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
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Reset Password
          </h1>
          <p className="text-sm text-black/70">
            Set a new password for your account.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Update password</CardTitle>
            <CardDescription>
              Open this page from your reset email link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-black/70">Loading session...</p>
            ) : !session ? (
              <p className="text-sm text-black/70">
                Session not found. Open the reset link from your email again.
              </p>
            ) : (
              <form className="flex flex-col gap-4" onSubmit={handleUpdatePassword}>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  New password
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Password"}
                </PrimaryButton>
              </form>
            )}

            {error ? <p className="mt-3 text-sm font-semibold text-black">{error}</p> : null}
            {message ? <p className="mt-3 text-sm text-black/70">{message}</p> : null}
          </CardContent>
        </Card>

        <SecondaryButton asChild className="w-full">
          <Link href="/account/login">Back to Login</Link>
        </SecondaryButton>
      </Stack>
    </PageContainer>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

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

export default function AccountLoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isRecovering, setIsRecovering] = React.useState(false)
  const [nextPath, setNextPath] = React.useState<"" | "/join" | "/create">("")

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    setNextPath(next === "/join" || next === "/create" ? next : "")
  }, [])

  const accountHref = nextPath
    ? `/account?next=${encodeURIComponent(nextPath)}`
    : "/account"
  const signupHref = nextPath
    ? `/account/signup?next=${encodeURIComponent(nextPath)}`
    : "/account/signup"

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password.")
      return
    }

    setIsSubmitting(true)

    try {
      const { error: authError } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.push(nextPath || "/account")
    } catch (error) {
      setError(String((error as Error)?.message ?? error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecoverPassword = async () => {
    setError("")
    setMessage("")

    if (!email.trim()) {
      setError("Enter your email first, then tap Forgot password.")
      return
    }

    setIsRecovering(true)

    try {
      const { error: recoverError } = await supabaseBrowser.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/account/reset-password`,
        }
      )

      if (recoverError) {
        setError(recoverError.message)
        return
      }

      setMessage("Password reset email sent. Check your inbox.")
    } catch (error) {
      setError(String((error as Error)?.message ?? error))
    } finally {
      setIsRecovering(false)
    }
  }

  return (
    <PageContainer>
      <Stack className="gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Login
          </h1>
          <p className="text-sm text-black/70">
            Sign in to access your saved photos and account features.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Account login</CardTitle>
            <CardDescription>Email and password only.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                />
              </label>

              <label className="text-sm font-semibold uppercase tracking-wide">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                />
              </label>

              <PrimaryButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Login"}
              </PrimaryButton>

              <SecondaryButton
                type="button"
                disabled={isRecovering}
                onClick={handleRecoverPassword}
              >
                {isRecovering ? "Sending..." : "Forgot password?"}
              </SecondaryButton>

              {error ? (
                <p className="text-sm font-semibold text-black">{error}</p>
              ) : null}
              {message ? <p className="text-sm text-black/70">{message}</p> : null}
            </form>
          </CardContent>
        </Card>

        <SecondaryButton asChild className="w-full">
          <Link href={signupHref}>Need an account? Create one</Link>
        </SecondaryButton>
        <SecondaryButton asChild className="w-full">
          <Link href={accountHref}>Back to Account</Link>
        </SecondaryButton>
      </Stack>
    </PageContainer>
  )
}

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"
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

export default function AccountSignupPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isGoogleSigningIn, setIsGoogleSigningIn] = React.useState(false)
  const [nextPath, setNextPath] = React.useState<"" | "/join" | "/create">("")

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    setNextPath(next === "/join" || next === "/create" ? next : "")
  }, [])

  const accountHref = nextPath
    ? `/account?next=${encodeURIComponent(nextPath)}`
    : "/account"
  const loginHref = nextPath
    ? `/account/login?next=${encodeURIComponent(nextPath)}`
    : "/account/login"

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Fill in email, password, and confirm password.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error: authError } = await supabaseBrowser.auth.signUp({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (data.session) {
        router.push(nextPath || "/account")
        return
      }

      setMessage("Account created. Check your email to verify your account.")
      setPassword("")
      setConfirmPassword("")
    } catch {
      setError("Unable to create account.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    setMessage("")
    setIsGoogleSigningIn(true)

    try {
      const { error: oauthError } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${nextPath || "/account"}`,
        },
      })

      if (oauthError) {
        setError(`GOOGLE_SIGNUP_ERROR | detail=${oauthError.message}`)
      }
    } catch {
      setError("Unable to continue with Google.")
    } finally {
      setIsGoogleSigningIn(false)
    }
  }

  return (
    <PageContainer>
      <Stack className="gap-6">
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Create Account
          </h1>
          <p className="text-sm text-black/70">
            Save photos to your account and reuse them in future games.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Sign up</CardTitle>
            <CardDescription>Email and password only.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSignUp}>
              <GoogleOAuthButton
                disabled={isGoogleSigningIn || isSubmitting}
                onClick={handleGoogleSignIn}
                isLoading={isGoogleSigningIn}
              >
                Continue with Google
              </GoogleOAuthButton>

              <p className="text-center text-xs font-semibold uppercase tracking-wide text-black/50">
                or continue with email
              </p>

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
                {isSubmitting ? "Creating..." : "Create Account"}
              </PrimaryButton>

              {error ? (
                <p className="text-sm font-semibold text-black">{error}</p>
              ) : null}
              {message ? <p className="text-sm text-black/70">{message}</p> : null}
            </form>
          </CardContent>
        </Card>

        <SecondaryButton asChild className="w-full">
          <Link href={loginHref}>Already have an account? Login</Link>
        </SecondaryButton>
        <SecondaryButton asChild className="w-full">
          <Link href={accountHref}>Back to Account</Link>
        </SecondaryButton>
      </Stack>
    </PageContainer>
  )
}

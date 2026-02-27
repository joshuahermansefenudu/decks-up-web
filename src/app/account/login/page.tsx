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
import { ErrorDebugPanel } from "@/components/ui/error-debug-panel"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"
import { formatThrownError } from "@/lib/client-error"
import { supabaseBrowser } from "@/lib/supabase-browser"

export default function AccountLoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isRecovering, setIsRecovering] = React.useState(false)
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
        setError(`LOGIN_ERROR | detail=${authError.message}`)
        return
      }

      router.push(nextPath || "/account")
    } catch (error) {
      setError(formatThrownError(error, "LOGIN_ERROR"))
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
        setError(`PASSWORD_RESET_ERROR | detail=${recoverError.message}`)
        return
      }

      setMessage("Password reset email sent. Check your inbox.")
    } catch (error) {
      setError(formatThrownError(error, "PASSWORD_RESET_ERROR"))
    } finally {
      setIsRecovering(false)
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
        setError(`GOOGLE_LOGIN_ERROR | detail=${oauthError.message}`)
      }
    } catch (error) {
      setError(formatThrownError(error, "GOOGLE_LOGIN_ERROR"))
    } finally {
      setIsGoogleSigningIn(false)
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

              {error ? <ErrorDebugPanel message={error} /> : null}
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

"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

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

export default function AccountSignupPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [nextPath, setNextPath] = React.useState<"" | "/join" | "/create">("")

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    setNextPath(next === "/join" || next === "/create" ? next : "")
  }, [])

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

        <Link
          href={loginHref}
          className="inline-flex w-full items-center justify-center rounded-full border-2 border-black bg-white px-6 py-3 text-base font-semibold uppercase tracking-wide text-black shadow-[4px_4px_0_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
        >
          Already have an account? Login
        </Link>
      </Stack>
    </PageContainer>
  )
}

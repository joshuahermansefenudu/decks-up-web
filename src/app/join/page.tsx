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
import { ErrorDebugPanel } from "@/components/ui/error-debug-panel"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"
import { formatResponseError, formatThrownError } from "@/lib/client-error"
import { getAccessTokenSafe } from "@/lib/safe-auth"

const errorMessages: Record<string, string> = {
  invalid_request: "Add your name and a lobby code.",
  not_found: "Lobby not found. Double-check the code.",
  expired: "That lobby has expired.",
  lobby_full: "That lobby is already full.",
  not_open: "That lobby is no longer accepting players.",
}

export default function JoinPage() {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState("")
  const [toastMessage, setToastMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const status = searchParams.get("status")
    const codeParam = searchParams.get("code")

    if (status === "removed_by_host") {
      setToastMessage("You were removed from the lobby by the host.")
    }

    if (codeParam) {
      setCode(codeParam.toUpperCase())
    }
  }, [])

  React.useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timer = window.setTimeout(() => {
      setToastMessage("")
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [toastMessage])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!name.trim() || !code.trim()) {
      setError(errorMessages.invalid_request)
      return
    }

    setIsSubmitting(true)

    try {
      const accessToken = await getAccessTokenSafe()
      const response = await fetch("/api/lobbies/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ name, code }),
      })

      if (!response.ok) {
        const debugError = await formatResponseError(response, "JOIN_LOBBY_ERROR")
        const payloadText = debugError.toLowerCase()

        if (payloadText.includes("detail=not_found")) {
          setError(
            `${errorMessages.not_found}\n${debugError}`
          )
          return
        }

        if (payloadText.includes("detail=expired")) {
          setError(
            `${errorMessages.expired}\n${debugError}`
          )
          return
        }

        if (payloadText.includes("detail=lobby_full")) {
          setError(
            `${errorMessages.lobby_full}\n${debugError}`
          )
          return
        }

        if (payloadText.includes("detail=not_open")) {
          setError(
            `${errorMessages.not_open}\n${debugError}`
          )
          return
        }

        if (payloadText.includes("detail=invalid_request")) {
          setError(
            `${errorMessages.invalid_request}\n${debugError}`
          )
          return
        }

        setError(debugError)
        return
      }

      const payload = await response.json()
      router.push(`/lobby/${payload.code}?playerId=${payload.playerId}`)
    } catch (error) {
      setError(formatThrownError(error, "JOIN_LOBBY_ERROR"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageContainer>
      <Stack className="gap-6">
        {toastMessage ? (
          <div
            role="status"
            className="rounded-xl border-2 border-black bg-primary px-4 py-3 text-sm font-semibold text-black shadow-[3px_3px_0_#000]"
          >
            {toastMessage}
          </div>
        ) : null}
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Join Game
          </h1>
          <p className="text-sm text-black/70">
            Enter your name and the lobby code from the host.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Player details</CardTitle>
            <CardDescription>Jump into an existing lobby.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Your name
                <input
                  type="text"
                  name="playerName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Sam"
                  className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                />
              </label>

              <label className="text-sm font-semibold uppercase tracking-wide">
                Lobby code
                <input
                  type="text"
                  name="lobbyCode"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="e.g. DEMO1"
                  className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base uppercase tracking-widest shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                />
              </label>

              {error ? <ErrorDebugPanel message={error} /> : null}

              <PrimaryButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Joining..." : "Join Lobby"}
              </PrimaryButton>
            </form>

            <SecondaryButton asChild className="mt-4 w-full">
              <Link href="/">Back Home</Link>
            </SecondaryButton>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  )
}

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
import { ErrorDebugPanel } from "@/components/ui/error-debug-panel"
import { PrimaryButton } from "@/components/ui/primary-button"
import { formatResponseError, formatThrownError } from "@/lib/client-error"
import { getAccessTokenSafe } from "@/lib/safe-auth"

const MIN_PLAYERS = 2
const MODE_MAX_PLAYERS: Record<"in_person" | "virtual", number> = {
  in_person: 12,
  virtual: 8,
}

export default function CreatePage() {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [playMode, setPlayMode] = React.useState<"in_person" | "virtual">(
    "virtual"
  )
  const [maxPlayers, setMaxPlayers] = React.useState(8)
  const [error, setError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get("mode")

    if (mode === "in_person" || mode === "virtual") {
      setPlayMode(mode)
    }
  }, [])

  React.useEffect(() => {
    const modeCap = MODE_MAX_PLAYERS[playMode]
    setMaxPlayers((current) => {
      if (current < MIN_PLAYERS) {
        return MIN_PLAYERS
      }
      if (current > modeCap) {
        return modeCap
      }
      return current
    })
  }, [playMode])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("invalid_name")
      return
    }

    setIsSubmitting(true)

    try {
      const accessToken = await getAccessTokenSafe()
      const response = await fetch("/api/lobbies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ name, mode: playMode, maxPlayers }),
      })

      if (!response.ok) {
        setError(await formatResponseError(response, "CREATE_LOBBY_ERROR"))
        return
      }

      const payload = await response.json()
      router.push(`/lobby/${payload.code}?playerId=${payload.playerId}`)
    } catch (error) {
      setError(formatThrownError(error, "CREATE_LOBBY_ERROR"))
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
            Create Game
          </h1>
          <p className="text-sm text-black/70">
            Pick a name so your crew knows who started the lobby.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Host details</CardTitle>
            <CardDescription>Creates a lobby and adds you as host.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Your name
                <input
                  type="text"
                  name="hostName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Joshua"
                  className="mt-2 w-full rounded-xl border-2 border-black bg-offwhite px-4 py-3 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                />
              </label>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-wide">
                  Play mode
                </p>
                <div className="flex w-full rounded-full border-2 border-black bg-lightgray p-1 shadow-[3px_3px_0_#000]">
                  <button
                    type="button"
                    onClick={() => setPlayMode("in_person")}
                    className={`flex flex-1 items-center justify-center rounded-full px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite ${
                      playMode === "in_person"
                        ? "bg-offwhite text-black shadow-[2px_2px_0_#000]"
                        : "bg-transparent text-black/60"
                    }`}
                  >
                    In person
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayMode("virtual")}
                    className={`flex flex-1 items-center justify-center rounded-full px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite ${
                      playMode === "virtual"
                        ? "bg-offwhite text-black shadow-[2px_2px_0_#000]"
                        : "bg-transparent text-black/60"
                    }`}
                  >
                    Virtual (Video)
                  </button>
                </div>

                <label className="block text-sm font-semibold uppercase tracking-wide">
                  Player limit
                  <div className="relative mt-2">
                    <select
                      name="maxPlayers"
                      value={maxPlayers}
                      onChange={(event) =>
                        setMaxPlayers(Number.parseInt(event.target.value, 10))
                      }
                      className="w-full appearance-none rounded-xl border-2 border-black bg-offwhite px-4 py-3 pr-14 text-base shadow-[3px_3px_0_#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                    >
                      {Array.from(
                        {
                          length: MODE_MAX_PLAYERS[playMode] - MIN_PLAYERS + 1,
                        },
                        (_, index) => MIN_PLAYERS + index
                      ).map((count) => (
                        <option key={count} value={count}>
                          {count} players
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-5 w-5 stroke-black"
                        fill="none"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 7.5L10 12.5L15 7.5" />
                      </svg>
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium normal-case text-black/70">
                    {playMode === "in_person"
                      ? "In-person supports 2 to 12 players."
                      : "Virtual supports 2 to 8 players."}
                  </p>
                </label>

                <div className="rounded-2xl border-2 border-black bg-offwhite p-4 shadow-[4px_4px_0_#000]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
                    The gameplay
                  </p>
                  <div
                    className="mt-3 overflow-hidden rounded-xl border-2 border-dashed border-black/60"
                    style={{ backgroundColor: "#FED32F" }}
                  >
                    {playMode === "in_person" ? (
                      <img
                        src="/mode-in-person.png"
                        alt="In-person gameplay"
                        className="h-64 w-full object-contain"
                      />
                    ) : (
                      <img
                        src="/mode-virtual.png"
                        alt="Virtual gameplay"
                        className="h-64 w-full object-contain"
                      />
                    )}
                  </div>
                  <p className="mt-3 text-sm text-black/70">
                    {playMode === "in_person"
                      ? "Hold up your phone above your head when it's your turn."
                      : "Just like a video call."}
                  </p>
                </div>
              </div>

              <PrimaryButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Lobby"}
              </PrimaryButton>

              {error ? <ErrorDebugPanel message={error} /> : null}
            </form>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  )
}

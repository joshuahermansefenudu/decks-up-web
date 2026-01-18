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

export default function CreatePage() {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [playMode, setPlayMode] = React.useState<"in_person" | "virtual">(
    "in_person"
  )
  const [error, setError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("invalid_name")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mode: playMode }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        if (payload?.error) {
          setError(payload.error)
        } else {
          setError("Unknown error")
        }
        return
      }

      const payload = await response.json()
      router.push(`/lobby/${payload.code}?playerId=${payload.playerId}`)
    } catch {
      setError("Unknown error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageContainer>
      <Stack className="gap-6">
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

              {error ? (
                <p className="text-sm font-semibold text-black" role="status">
                  {error}
                </p>
              ) : null}
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

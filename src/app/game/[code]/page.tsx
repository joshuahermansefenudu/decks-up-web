import Link from "next/link"

import { GameScreen } from "@/components/game/game-screen"
import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"
import { SecondaryButton } from "@/components/ui/secondary-button"
import { getBaseUrl } from "@/lib/base-url"

type GameResponse = {
  lobby: {
    id: string
    code: string
    status: string
    mode: "IN_PERSON" | "VIRTUAL"
    activePlayerId: string | null
    currentCardIndex: number
    currentTurnIndex: number
  }
  players: Array<{
    id: string
    name: string
    isHost: boolean
    planType: "FREE" | "CORE" | "PRO"
  }>
  photos: {
    currentCard: {
      id: string
      title: string
      publicUrl: string
    } | null
  }
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams?: Promise<{ playerId?: string }>
}) {
  const { code } = await params
  const sp = searchParams ? await searchParams : undefined
  const playerId = sp?.playerId

  if (!code) {
    return (
      <PageContainer>
        <Stack className="gap-6">
          <header className="space-y-2">
            <h1 className="font-display text-3xl uppercase tracking-wide">
              Game
            </h1>
            <p className="text-sm text-black/70">
              Missing lobby code. Double-check the link.
            </p>
          </header>
          <SecondaryButton asChild className="w-full">
            <Link href="/">Back Home</Link>
          </SecondaryButton>
        </Stack>
      </PageContainer>
    )
  }

  const lobbyUrl = new URL(`${getBaseUrl()}/api/lobbies/${code}`)
  if (playerId) {
    lobbyUrl.searchParams.set("playerId", playerId)
  }

  const response = await fetch(lobbyUrl.toString(), { cache: "no-store" })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message =
      payload?.error === "expired"
        ? "This lobby has expired."
        : "Lobby not found."

    return (
      <PageContainer>
        <Stack className="gap-6">
          <header className="space-y-2">
            <h1 className="font-display text-3xl uppercase tracking-wide">
              Game
            </h1>
            <p className="text-sm text-black/70">{message}</p>
          </header>
          <SecondaryButton asChild className="w-full">
            <Link href="/">Back Home</Link>
          </SecondaryButton>
        </Stack>
      </PageContainer>
    )
  }

  const data = (await response.json()) as GameResponse

  return <GameScreen initialState={data} playerId={playerId} />
}

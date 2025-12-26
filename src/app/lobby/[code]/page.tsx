import Link from "next/link"

import { LobbyUploader } from "@/components/lobby/lobby-uploader"
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
import { SecondaryButton } from "@/components/ui/secondary-button"
import { getBaseUrl } from "@/lib/base-url"
import { LobbyRealtime } from "@/components/lobby/lobby-realtime"
import { LobbyExitButton } from "@/components/lobby/lobby-exit-button"
import AdSlot from "@/components/ads/AdSlot"
import { LobbyCode } from "@/components/lobby/lobby-code"

type LobbyResponse = {
  lobby: {
    id: string
    code: string
    status: string
    createdAt: string
    expiresAt: string
    hostPlayerId: string | null
    activePlayerId: string | null
    currentCardIndex: number
    currentTurnIndex: number
    endedAt: string | null
  }
  players: Array<{
    id: string
    name: string
    isHost: boolean
    createdAt: string
    photoCount: number
  }>
  photos: {
    totalPhotos: number
    myPhotos: Array<{
      id: string
      title: string
      publicUrl: string
      createdAt: string
    }>
    currentCard: {
      id: string
      title: string
      publicUrl: string
    } | null
  }
}

export default async function LobbyPage({
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
              Lobby
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

  const response = await fetch(lobbyUrl.toString(), {
    cache: "no-store",
  })

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
              Lobby
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

  const data = (await response.json()) as LobbyResponse
  const playersCount = data.players.length
  const selfPlayer = playerId
    ? data.players.find((player) => player.id === playerId)
    : undefined
  const isHost =
    Boolean(selfPlayer?.isHost) || data.lobby.hostPlayerId === playerId

  return (
    <PageContainer>
      <LobbyRealtime
        lobbyId={data.lobby.id}
        lobbyCode={data.lobby.code}
        playerId={playerId}
        lobbyStatus={data.lobby.status}
      />
      <Stack className="gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-display text-3xl uppercase tracking-wide">
              Lobby
            </h1>
            <p className="text-sm text-black/70">
              Share the code and upload up to two photos.
            </p>
          </div>
          <div className="shrink-0">
            <LobbyExitButton lobbyCode={data.lobby.code} playerId={playerId} />
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Game Code: {data.lobby.code}</CardTitle>
              <CardDescription>Send this to your crew.</CardDescription>
            </CardHeader>
            <CardContent>
              <LobbyCode code={data.lobby.code} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Players ({playersCount}/8)</CardTitle>
              <CardDescription>Waiting for players to join.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-black/70">
              {playersCount === 0 ? (
                "No one has joined yet."
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.players.map((player) => (
                    <li
                      key={player.id}
                      className="flex items-center justify-between rounded-lg border-2 border-black bg-offwhite px-3 py-2 shadow-[2px_2px_0_#000]"
                    >
                      <span className="font-semibold">
                        {player.name}
                        {player.isHost ? " (Host)" : ""}
                      </span>
                      <Badge variant="outline" className="min-w-[56px] justify-center">
                        {Math.min(player.photoCount, 2)}/2
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <AdSlot slot="LOBBY_BANNER" className="mt-6 flex justify-center" />

        <LobbyUploader
          lobbyCode={data.lobby.code}
          playerId={playerId}
          initialPhotos={data.photos.myPhotos}
          totalPhotos={data.photos.totalPhotos}
          isHost={isHost}
          lobbyStatus={data.lobby.status}
        />
      </Stack>
    </PageContainer>
  )
}

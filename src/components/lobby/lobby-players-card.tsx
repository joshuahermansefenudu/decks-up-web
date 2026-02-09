"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SecondaryButton } from "@/components/ui/secondary-button"

type LobbyPlayer = {
  id: string
  name: string
  isHost: boolean
  photoCount: number
}

type LobbyPlayersCardProps = {
  lobbyCode: string
  lobbyStatus: string
  players: LobbyPlayer[]
  currentPlayerId?: string
  isHost: boolean
}

const removeErrorMessages: Record<string, string> = {
  forbidden: "Only the host can remove players.",
  target_not_found: "Player not found.",
  cannot_remove_self: "Use Exit to leave your own lobby slot.",
  cannot_remove_host: "Host cannot be removed.",
  not_open: "You can only remove players before the game starts.",
}

function LobbyPlayersCard({
  lobbyCode,
  lobbyStatus,
  players,
  currentPlayerId,
  isHost,
}: LobbyPlayersCardProps) {
  const router = useRouter()
  const [removingId, setRemovingId] = React.useState("")
  const [error, setError] = React.useState("")

  const playersCount = players.length
  const canRemovePlayers = isHost && lobbyStatus === "LOBBY" && Boolean(currentPlayerId)

  const handleRemovePlayer = async (targetPlayerId: string) => {
    if (!currentPlayerId || !canRemovePlayers) {
      return
    }

    setError("")
    setRemovingId(targetPlayerId)

    try {
      const response = await fetch("/api/lobbies/remove-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobbyCode,
          requesterPlayerId: currentPlayerId,
          targetPlayerId,
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(
          removeErrorMessages[payload?.error] ?? "Unable to remove player."
        )
        return
      }

      router.refresh()
    } catch {
      setError("Unable to remove player.")
    } finally {
      setRemovingId("")
    }
  }

  return (
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
            {players.map((player) => {
              const canRemoveThisPlayer =
                canRemovePlayers &&
                player.id !== currentPlayerId &&
                !player.isHost

              return (
                <li
                  key={player.id}
                  className="flex items-center justify-between gap-2 rounded-lg border-2 border-black bg-offwhite px-3 py-2 shadow-[2px_2px_0_#000]"
                >
                  <span className="font-semibold">
                    {player.name}
                    {player.isHost ? " (Host)" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="min-w-[56px] justify-center">
                      {Math.min(player.photoCount, 5)}/5
                    </Badge>
                    {canRemoveThisPlayer ? (
                      <SecondaryButton
                        type="button"
                        className="px-2 py-1 text-xs"
                        disabled={removingId === player.id}
                        onClick={() => handleRemovePlayer(player.id)}
                      >
                        {removingId === player.id ? "Removing..." : "Remove"}
                      </SecondaryButton>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {error ? (
          <p className="mt-3 text-sm font-semibold text-black">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { LobbyPlayersCard }

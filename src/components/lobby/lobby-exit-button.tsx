"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { SecondaryButton } from "@/components/ui/secondary-button"

type LobbyExitButtonProps = {
  lobbyCode: string
  playerId?: string
}

function LobbyExitButton({ lobbyCode, playerId }: LobbyExitButtonProps) {
  const router = useRouter()
  const [isLeaving, setIsLeaving] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleExit = async () => {
    if (!playerId) {
      router.push("/")
      return
    }

    setIsLeaving(true)
    setError("")

    try {
      const response = await fetch("/api/lobbies/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyCode, playerId }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload?.error ?? "Unable to leave lobby.")
        return
      }
    } finally {
      setIsLeaving(false)
    }
    router.push("/")
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <SecondaryButton type="button" onClick={handleExit} disabled={isLeaving}>
        {isLeaving ? "Leaving..." : "Exit"}
      </SecondaryButton>
      {error ? (
        <p className="text-xs font-semibold text-black">{error}</p>
      ) : null}
    </div>
  )
}

export { LobbyExitButton }

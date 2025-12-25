"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { supabaseBrowser } from "@/lib/supabase-browser"

type LobbyRealtimeProps = {
  lobbyId: string
  lobbyCode: string
  playerId?: string
  lobbyStatus?: string
}

function LobbyRealtime({
  lobbyId,
  lobbyCode,
  playerId,
  lobbyStatus,
}: LobbyRealtimeProps) {
  const router = useRouter()

  useEffect(() => {
    if (!lobbyId) {
      return
    }

    const channel = supabaseBrowser
      .channel(`lobby-${lobbyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Player",
          filter: `lobbyId=eq.${lobbyId}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Photo",
          filter: `lobbyId=eq.${lobbyId}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Lobby",
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          router.refresh()
          const nextStatus = payload.new?.status
          if (nextStatus === "IN_GAME" && playerId) {
            router.push(`/game/${lobbyCode}?playerId=${playerId}`)
          }
        }
      )
      .subscribe()

    const refreshInterval = window.setInterval(() => {
      router.refresh()
    }, 5000)

    return () => {
      supabaseBrowser.removeChannel(channel)
      window.clearInterval(refreshInterval)
    }
  }, [lobbyCode, lobbyId, playerId, router])

  useEffect(() => {
    if (lobbyStatus === "IN_GAME" && playerId) {
      router.push(`/game/${lobbyCode}?playerId=${playerId}`)
    }
  }, [lobbyCode, lobbyStatus, playerId, router])

  return null
}

export { LobbyRealtime }

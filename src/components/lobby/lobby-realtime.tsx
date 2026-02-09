"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { supabaseBrowser } from "@/lib/supabase-browser"

type LobbyRow = { status: string; [key: string]: any }
type PlayerRowPayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE"
  new: { id?: string } | null
  old: { id?: string } | null
}

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
  const hasRedirectedRef = useRef(false)

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
        (payload: PlayerRowPayload) => {
          if (
            !hasRedirectedRef.current &&
            playerId &&
            payload.eventType === "DELETE" &&
            payload.old?.id === playerId
          ) {
            hasRedirectedRef.current = true
            router.replace(`/removed?code=${encodeURIComponent(lobbyCode)}`)
            return
          }

          router.refresh()
        }
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
        (payload: {
          new: Partial<LobbyRow> | null
          old: Partial<LobbyRow> | null
        }) => {
          router.refresh()
          const nextStatus = payload.new?.status
          if (nextStatus === "IN_GAME" && playerId) {
            router.push(`/game/${lobbyCode}?playerId=${playerId}`)
          }
        }
      )
      .subscribe()

    const refreshInterval = window.setInterval(() => {
      if (hasRedirectedRef.current) {
        return
      }
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

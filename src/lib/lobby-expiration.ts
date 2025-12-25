import { purgeLobbyGameplayData } from "@/lib/lobby-cleanup"

export async function expireLobbyIfNeeded(lobby: {
  id: string
  expiresAt: Date
  endedAt?: Date | null
}) {
  const now = Date.now()
  const endedAt = lobby.endedAt ? lobby.endedAt.getTime() : null
  const expiresAt = lobby.expiresAt.getTime()

  if (endedAt !== null && endedAt <= now) {
    try {
      await purgeLobbyGameplayData(lobby.id)
    } catch (error) {
      console.error("LOBBY_CLEANUP_ERROR", error)
    }
    return false
  }

  if (expiresAt <= now) {
    try {
      await purgeLobbyGameplayData(lobby.id)
    } catch (error) {
      console.error("LOBBY_CLEANUP_ERROR", error)
    }
    return true
  }

  return false
}

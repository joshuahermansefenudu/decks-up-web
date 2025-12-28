"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"
import AdSlot from "@/components/ads/AdSlot"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { useKeepScreenAwake } from "@/lib/useKeepScreenAwake"

type Player = {
  id: string
  name: string
  isHost: boolean
}

type Card = {
  id: string
  title: string
  publicUrl: string
}

type GameState = {
  lobby: {
    id: string
    code: string
    status: string
    activePlayerId: string | null
    currentCardIndex: number
    currentTurnIndex: number
  }
  players: Player[]
  photos: {
    currentCard: Card | null
  }
}

type GameScreenProps = {
  initialState: GameState
  playerId?: string
}

function GameScreen({ initialState, playerId }: GameScreenProps) {
  const router = useRouter()
  const [state, setState] = React.useState(initialState)
  const [hasSeenTutorial, setHasSeenTutorial] = React.useState(false)
  const [countdown, setCountdown] = React.useState<number | null>(null)
  const [showCard, setShowCard] = React.useState(false)
  const [lastTurnIndex, setLastTurnIndex] = React.useState<number | null>(null)
  const [actionError, setActionError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const fetchState = React.useCallback(async () => {
    const response = await fetch(
      `/api/lobbies/${initialState.lobby.code}?playerId=${playerId ?? ""}`
    )
    if (!response.ok) {
      return
    }
    const payload = (await response.json()) as GameState
    setState(payload)
  }, [initialState.lobby.code, playerId])

  const isActive = state.lobby.activePlayerId === playerId
  const keepAwakeEnabled = hasSeenTutorial && state.lobby.status === "IN_GAME"
  const wakeLock = useKeepScreenAwake(keepAwakeEnabled)

  React.useEffect(() => {
    if (!hasSeenTutorial) {
      return
    }

    if (!isActive) {
      setCountdown(null)
      setShowCard(false)
      return
    }

    if (lastTurnIndex !== state.lobby.currentTurnIndex) {
      setLastTurnIndex(state.lobby.currentTurnIndex)
      setShowCard(false)
      setCountdown(10)
    }
  }, [hasSeenTutorial, isActive, lastTurnIndex, state.lobby.currentTurnIndex])

  React.useEffect(() => {
    if (countdown === null) {
      return
    }

    if (countdown <= 0) {
      setCountdown(null)
      setShowCard(true)
      return
    }

    const timer = window.setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [countdown])

  React.useEffect(() => {
    const lobbyId = initialState.lobby.id
    const channel = supabaseBrowser
      .channel(`game-${lobbyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Lobby", filter: `id=eq.${lobbyId}` },
        fetchState
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Player", filter: `lobbyId=eq.${lobbyId}` },
        fetchState
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Photo", filter: `lobbyId=eq.${lobbyId}` },
        fetchState
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [fetchState, initialState.lobby.id])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      fetchState()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [fetchState])

  const activePlayer = state.players.find(
    (player) => player.id === state.lobby.activePlayerId
  )

  const handleNext = async () => {
    if (!playerId) {
      setActionError("Missing player id.")
      return
    }

    setIsSubmitting(true)
    setActionError("")

    try {
      const response = await fetch("/api/game/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyCode: state.lobby.code, playerId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setActionError(payload?.error ?? "Unable to advance turn.")
        return
      }
      await fetchState()
    } catch {
      setActionError("Unable to advance turn.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLeave = async () => {
    if (!playerId) {
      router.push("/")
      return
    }

    setIsSubmitting(true)
    setActionError("")

    try {
      const response = await fetch("/api/game/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyCode: state.lobby.code, playerId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setActionError(payload?.error ?? "Unable to leave game.")
        return
      }
      router.push("/")
    } catch {
      setActionError("Unable to leave game.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (state.lobby.status === "ENDED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide">
          Game Over
        </h1>
        <p className="text-sm text-black/70">Thanks for playing!</p>
        <SecondaryButton type="button" onClick={() => router.push("/")}
        >
          Back Home
        </SecondaryButton>
        <AdSlot slot="RESULTS_BANNER" className="mt-6 flex justify-center" />
      </div>
    )
  }

  if (!hasSeenTutorial) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 pb-10 pt-8">
        <div className="w-full max-w-md">
          <header className="text-left">
            <h1 className="font-display text-3xl uppercase tracking-wide">
              How to Play
            </h1>
            <p className="mt-2 text-sm text-black/70">
              Quick rules before we start the round.
            </p>
          </header>

          <div className="mt-6 rounded-3xl border-2 border-black bg-offwhite p-6 shadow-[6px_6px_0_#000]">
            <div className="grid gap-4">
              <div className="flex items-start gap-3 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-primary shadow-[2px_2px_0_#000]">
                  <div className="h-6 w-3 rounded-sm border-2 border-black bg-offwhite -rotate-90" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Hold Phone Up
                  </p>
                  <p className="text-sm text-black/80">
                    Active player holds the phone above their head.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-primary shadow-[2px_2px_0_#000]">
                  <div className="h-6 w-6 rounded-md border-2 border-black bg-offwhite" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Give Hints
                  </p>
                  <p className="text-sm text-black/80">
                    Teammates give clues without saying the title.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-primary shadow-[2px_2px_0_#000]">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-black">
                    Next
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Next Card
                  </p>
                  <p className="text-sm text-black/80">
                    Tap Next to advance to the next player and card.
                  </p>
                </div>
              </div>
            </div>

            <PrimaryButton
              className="mt-6 w-full"
              type="button"
              onClick={() => setHasSeenTutorial(true)}
            >
              I'm Ready
            </PrimaryButton>
          </div>
        </div>
      </div>
    )
  }

  if (state.lobby.status === "LOBBY") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide">
          Game Starting
        </h1>
        <p className="text-sm text-black/70">
          Hang tight while the host starts the game.
        </p>
        <div className="flex gap-2 text-lg font-bold">
          <span className="animate-pulse">.</span>
          <span className="animate-pulse [animation-delay:200ms]">.</span>
          <span className="animate-pulse [animation-delay:400ms]">.</span>
        </div>
        <SecondaryButton type="button" onClick={() => router.push("/")}>
          Back Home
        </SecondaryButton>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 px-4 pb-10 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Game Time
          </h1>
          <p className="text-sm text-black/70">Code: {state.lobby.code}</p>
        </div>
        <SecondaryButton type="button" onClick={handleLeave}>
          Leave Game
        </SecondaryButton>
      </header>

      {isActive ? (
        <div className="flex flex-1 flex-col gap-4">
          {countdown !== null ? (
            <div
              className="fixed inset-0 z-20 h-[100dvh] w-[100dvw] touch-none overflow-hidden overscroll-none"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(180deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                backgroundColor: "var(--offwhite)",
              }}
            >
              {/* CSS-only rotation to simulate landscape without sensors. */}
              <div
                className="absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 rotate-90"
                style={{ width: "100dvh", height: "100dvw" }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center text-black">
                  <p className="text-sm font-semibold uppercase tracking-wide text-black">
                    Your turn
                  </p>
                  <h2 className="font-display text-2xl uppercase tracking-wide text-black">
                    Rotate phone to landscape and hold above your head
                  </h2>
                  <div className="mt-4 text-6xl font-bold text-black">
                    {countdown}
                  </div>
                  {keepAwakeEnabled && (!wakeLock.isSupported || wakeLock.hadError) ? (
                    <div className="mt-4 rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-xs text-black/70 shadow-[2px_2px_0_#000]">
                      <p>
                        Tip: Turn Low Power Mode off / keep your screen active in
                        your phone settings.
                      </p>
                      {!wakeLock.isActive ? (
                        <button
                          type="button"
                          className="mt-2 rounded-full border-2 border-black bg-primary px-3 py-1 text-xs font-semibold text-black shadow-[2px_2px_0_#000]"
                          onClick={() => wakeLock.requestWakeLock()}
                        >
                          Keep screen on
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : showCard && state.photos.currentCard ? (
            <div
              className="fixed inset-0 z-20 h-[100dvh] w-[100dvw] touch-none overflow-hidden overscroll-none"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(180deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                backgroundColor: "var(--offwhite)",
              }}
            >
              {/* CSS-only rotation to simulate landscape without sensors. */}
              <div
                className="absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 rotate-90"
                style={{ width: "100dvh", height: "100dvw" }}
              >
                <div className="flex h-full w-full flex-col gap-3 px-4 py-4">
                  <div className="flex min-h-0 flex-1 items-center justify-center gap-3">
                    <div className="flex h-full w-16 items-center justify-center">
                      <SecondaryButton
                        type="button"
                        onClick={handleLeave}
                        className="w-full"
                      >
                        Leave
                      </SecondaryButton>
                    </div>
                    <div className="flex min-h-0 w-[82%] items-center justify-center rounded-3xl border-2 border-black bg-lightgray/60 p-2 shadow-[6px_6px_0_#000]">
                      <img
                        src={state.photos.currentCard.publicUrl}
                        alt={state.photos.currentCard.title}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex h-full w-16 items-center justify-center">
                      <PrimaryButton
                        type="button"
                        onClick={handleNext}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        {isSubmitting ? "Advancing..." : "Next"}
                      </PrimaryButton>
                    </div>
                  </div>
                  <div className="mx-auto w-full max-w-[90%] rounded-2xl border-2 border-black bg-offwhite px-4 py-2 text-center shadow-[4px_4px_0_#000]">
                    <h2 className="font-display text-xl uppercase leading-tight tracking-wide text-black sm:text-2xl">
                      {state.photos.currentCard.title}
                    </h2>
                  </div>
                  {keepAwakeEnabled && (!wakeLock.isSupported || wakeLock.hadError) ? (
                    <div className="mx-auto w-full max-w-[90%] rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-center text-xs text-black/70 shadow-[2px_2px_0_#000]">
                      <p>
                        Tip: Turn Low Power Mode off / keep your screen active in
                        your phone settings.
                      </p>
                      {!wakeLock.isActive ? (
                        <button
                          type="button"
                          className="mt-2 rounded-full border-2 border-black bg-primary px-3 py-1 text-xs font-semibold text-black shadow-[2px_2px_0_#000]"
                          onClick={() => wakeLock.requestWakeLock()}
                        >
                          Keep screen on
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {actionError ? (
                    <p className="text-center text-sm font-semibold text-black">
                      {actionError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-black bg-offwhite p-6 shadow-[6px_6px_0_#000]">
              <h2 className="font-display text-2xl uppercase tracking-wide">
                No cards left
              </h2>
              <p className="text-sm text-black/70">
                Tap Next to wrap up.
              </p>
              <PrimaryButton
                className="mt-4 w-full"
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Finishing..." : "Next"}
              </PrimaryButton>
              {actionError ? (
                <p className="text-sm font-semibold text-black">{actionError}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-black bg-offwhite p-6 text-center shadow-[6px_6px_0_#000]">
          <p className="text-sm font-semibold uppercase tracking-wide">
            Give hints
          </p>
          <h2 className="font-display text-2xl uppercase tracking-wide">
            {activePlayer ? `${activePlayer.name}'s turn` : "Waiting"}
          </h2>
          <p className="text-sm text-black/70">
            Give hints without saying the title. The guesser can ask questions.
          </p>
          <div className="flex gap-2 text-lg font-bold">
            <span className="animate-pulse">.</span>
            <span className="animate-pulse [animation-delay:200ms]">.</span>
            <span className="animate-pulse [animation-delay:400ms]">.</span>
          </div>
          {keepAwakeEnabled && (!wakeLock.isSupported || wakeLock.hadError) ? (
            <div className="mt-2 rounded-xl border-2 border-black bg-lightgray px-3 py-2 text-xs text-black/70 shadow-[2px_2px_0_#000]">
              <p>
                Tip: Turn Low Power Mode off / keep your screen active in your
                phone settings.
              </p>
              {!wakeLock.isActive ? (
                <button
                  type="button"
                  className="mt-2 rounded-full border-2 border-black bg-primary px-3 py-1 text-xs font-semibold text-black shadow-[2px_2px_0_#000]"
                  onClick={() => wakeLock.requestWakeLock()}
                >
                  Keep screen on
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export { GameScreen }

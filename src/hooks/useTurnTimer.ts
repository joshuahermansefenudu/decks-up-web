"use client"

import * as React from "react"

type UseTurnTimerOptions = {
  durationSeconds: number
  urgentThresholdSeconds: number
  onExpire: () => void
  autoStart?: boolean
  key: string | number
}

type UseTurnTimerResult = {
  secondsLeft: number
  progress: number
  isUrgent: boolean
  isRunning: boolean
  start: () => void
  pause: () => void
  reset: () => void
}

export function useTurnTimer({
  durationSeconds,
  urgentThresholdSeconds,
  onExpire,
  autoStart = true,
  key,
}: UseTurnTimerOptions): UseTurnTimerResult {
  const durationMs = Math.max(0, durationSeconds * 1000)
  const [secondsLeft, setSecondsLeft] = React.useState(durationSeconds)
  const [isRunning, setIsRunning] = React.useState(false)

  const onExpireRef = React.useRef(onExpire)
  const startTimeRef = React.useRef<number | null>(null)
  const elapsedRef = React.useRef(0)
  const intervalRef = React.useRef<number | null>(null)
  const expiredRef = React.useRef(false)
  const runningRef = React.useRef(false)
  const resumeOnVisibleRef = React.useRef(false)

  React.useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  const setRunning = React.useCallback((next: boolean) => {
    runningRef.current = next
    setIsRunning(next)
  }, [])

  const stopTimer = React.useCallback(() => {
    if (intervalRef.current !== null && typeof window !== "undefined") {
      window.clearInterval(intervalRef.current)
    }
    intervalRef.current = null
  }, [])

  const updateTick = React.useCallback(() => {
    if (!runningRef.current || startTimeRef.current === null) {
      return
    }

    const now = Date.now()
    const elapsed = elapsedRef.current + (now - startTimeRef.current)
    const remainingMs = Math.max(0, durationMs - elapsed)
    const nextSeconds = Math.ceil(remainingMs / 1000)

    setSecondsLeft((prev) => (prev === nextSeconds ? prev : nextSeconds))

    if (remainingMs <= 0) {
      stopTimer()
      startTimeRef.current = null
      elapsedRef.current = durationMs
      setRunning(false)
      if (!expiredRef.current) {
        expiredRef.current = true
        onExpireRef.current()
      }
      return
    }
  }, [durationMs, setRunning, stopTimer])

  const start = React.useCallback(() => {
    if (runningRef.current || durationMs === 0) {
      return
    }
    if (typeof window === "undefined") {
      return
    }
    if (process.env.NODE_ENV === "development") {
      console.log("Turn timer start")
    }
    setRunning(true)
    startTimeRef.current = Date.now()
    updateTick()
    intervalRef.current = window.setInterval(updateTick, 250)
  }, [durationMs, setRunning, updateTick])

  const pause = React.useCallback(() => {
    if (!runningRef.current) {
      return
    }
    if (process.env.NODE_ENV === "development") {
      console.log("Turn timer pause")
    }
    if (startTimeRef.current !== null) {
      elapsedRef.current += Date.now() - startTimeRef.current
      startTimeRef.current = null
    }
    stopTimer()
    setRunning(false)
  }, [setRunning, stopTimer])

  const reset = React.useCallback(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Turn timer reset")
    }
    stopTimer()
    elapsedRef.current = 0
    startTimeRef.current = null
    expiredRef.current = false
    setRunning(false)
    setSecondsLeft(durationSeconds)
  }, [durationSeconds, setRunning, stopTimer])

  React.useEffect(() => {
    reset()
    if (autoStart) {
      start()
    }
  }, [autoStart, key, reset, start])

  React.useEffect(() => {
    if (!autoStart) {
      pause()
    }
  }, [autoStart, pause])

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && runningRef.current) {
        resumeOnVisibleRef.current = true
        pause()
      }
      if (document.visibilityState === "visible" && resumeOnVisibleRef.current) {
        resumeOnVisibleRef.current = false
        start()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      stopTimer()
    }
  }, [pause, start, stopTimer])

  const progress = durationSeconds > 0 ? secondsLeft / durationSeconds : 0
  const isUrgent = secondsLeft > 0 && secondsLeft <= urgentThresholdSeconds

  return {
    secondsLeft,
    progress,
    isUrgent,
    isRunning,
    start,
    pause,
    reset,
  }
}

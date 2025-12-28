"use client"

import * as React from "react"

type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
  addEventListener?: (type: "release", listener: () => void) => void
  removeEventListener?: (type: "release", listener: () => void) => void
}

type WakeLockState = {
  isSupported: boolean
  isActive: boolean
  hadError: boolean
  requestWakeLock: () => Promise<void>
}

export function useKeepScreenAwake(enabled: boolean): WakeLockState {
  const sentinelRef = React.useRef<WakeLockSentinelLike | null>(null)
  const [isSupported, setIsSupported] = React.useState(true)
  const [isActive, setIsActive] = React.useState(false)
  const [hadError, setHadError] = React.useState(false)

  const requestWakeLock = React.useCallback(async () => {
    if (typeof navigator === "undefined") {
      return
    }

    if (!("wakeLock" in navigator)) {
      setIsSupported(false)
      if (process.env.NODE_ENV === "development") {
        console.log("Wake lock unsupported")
      }
      return
    }

    setIsSupported(true)

    try {
      if (process.env.NODE_ENV === "development") {
        console.log("Requesting wake lock")
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wakeLock = await (navigator as any).wakeLock.request("screen")
      sentinelRef.current = wakeLock
      setIsActive(true)
      setHadError(false)
      if (process.env.NODE_ENV === "development") {
        console.log("Wake lock acquired")
      }

      const handleRelease = () => {
        setIsActive(false)
        if (process.env.NODE_ENV === "development") {
          console.log("Wake lock released")
        }
      }

      wakeLock.addEventListener?.("release", handleRelease)
    } catch (error) {
      setHadError(true)
      setIsActive(false)
      if (process.env.NODE_ENV === "development") {
        console.log("Wake lock failed", error)
      }
    }
  }, [])

  const releaseWakeLock = React.useCallback(async () => {
    const sentinel = sentinelRef.current
    if (!sentinel || sentinel.released) {
      return
    }
    try {
      await sentinel.release()
      if (process.env.NODE_ENV === "development") {
        console.log("Wake lock released")
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.log("Wake lock release failed", error)
      }
    } finally {
      sentinelRef.current = null
      setIsActive(false)
    }
  }, [])

  React.useEffect(() => {
    if (!enabled) {
      releaseWakeLock()
      return
    }

    requestWakeLock()

    return () => {
      releaseWakeLock()
    }
  }, [enabled, releaseWakeLock, requestWakeLock])

  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, requestWakeLock])

  return { isSupported, isActive, hadError, requestWakeLock }
}

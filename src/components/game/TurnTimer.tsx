"use client"

import * as React from "react"

type TurnTimerProps = {
  durationSeconds: number
  secondsLeft: number
  progress: number
  isUrgent: boolean
  onPauseToggle?: () => void
}

function TurnTimer({
  durationSeconds,
  secondsLeft,
  progress,
  isUrgent,
}: TurnTimerProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const size = 84
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clampedProgress)
  const label = `Time remaining: ${secondsLeft} seconds`

  return (
    <div
      className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-black bg-offwhite shadow-[4px_4px_0_#000] ${
        isUrgent ? "animate-pulse" : ""
      }`}
      aria-label={label}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={durationSeconds}
      aria-valuenow={secondsLeft}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          className="text-lightgray"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="text-primary"
        />
      </svg>
      <div className="relative text-center">
        <div className="text-2xl font-extrabold text-black">
          {secondsLeft}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-black/70">
          sec
        </div>
      </div>
    </div>
  )
}

export { TurnTimer }

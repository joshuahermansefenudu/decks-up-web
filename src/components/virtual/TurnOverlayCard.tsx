"use client"

import * as React from "react"

type TurnOverlayCardProps = {
  anchorX: number
  anchorY: number
  trackingVisible: boolean
  isGuesserViewer: boolean
  card: { title: string; publicUrl: string } | null
}

function TurnOverlayCard({
  anchorX,
  anchorY,
  trackingVisible,
  isGuesserViewer,
  card,
}: TurnOverlayCardProps) {
  const hasCard = Boolean(card) && !isGuesserViewer
  if (!hasCard && !isGuesserViewer) {
    return null
  }

  const style = trackingVisible
    ? {
        left: anchorX,
        top: anchorY,
        transform: "translate(-50%, -100%)",
      }
    : {
        left: "50%",
        top: "15%",
        transform: "translate(-50%, -100%)",
      }

  return (
    <div className="pointer-events-none absolute z-10" style={style}>
      {isGuesserViewer ? (
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-offwhite/90 text-4xl font-extrabold text-black shadow-[2px_2px_0_#000]">
          ?
        </div>
      ) : (
        <img
          src={card?.publicUrl}
          alt={card?.title}
          className="block h-48 w-48 object-cover"
        />
      )}
    </div>
  )
}

export { TurnOverlayCard }

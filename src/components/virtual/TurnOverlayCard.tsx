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
        transform: "translate(-50%, -120%)",
      }
    : {
        left: "50%",
        top: "24%",
        transform: "translate(-50%, -120%)",
      }

  return (
    <div className="pointer-events-none absolute z-10" style={style}>
      {isGuesserViewer ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-offwhite/90 text-3xl font-extrabold text-black shadow-[2px_2px_0_#000] sm:h-20 sm:w-20 sm:text-4xl">
          ?
        </div>
      ) : (
        <img
          src={card?.publicUrl}
          alt={card?.title}
          className="block h-20 w-20 object-contain sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32"
        />
      )}
    </div>
  )
}

export { TurnOverlayCard }

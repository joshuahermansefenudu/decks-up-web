"use client"

import * as React from "react"

type PlayModeSlide = {
  title: string
  imageSrc: string
  imageAlt: string
  subtitle: string
}

const SLIDES: PlayModeSlide[] = [
  {
    title: "In-Person Mode",
    imageSrc: "/mode-in-person.png",
    imageAlt: "In-person Decks Up gameplay illustration",
    subtitle: "Hold up your phone above your head when it's your turn.",
  },
  {
    title: "Virtual (Video) Mode",
    imageSrc: "/mode-virtual.png",
    imageAlt: "Virtual Decks Up gameplay illustration",
    subtitle: "Just like a video call.",
  },
]

const ROTATE_MS = 3800

export function PlayModeRotator() {
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % SLIDES.length)
    }, ROTATE_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const active = SLIDES[activeIndex]

  return (
    <div className="space-y-3">
      <div
        className="relative h-64 w-full overflow-hidden rounded-2xl border-2 border-black shadow-[4px_4px_0_#000] sm:h-72"
        style={{ backgroundColor: "#FED32F" }}
      >
        <img
          key={active.imageSrc}
          src={active.imageSrc}
          alt={active.imageAlt}
          className="h-full w-full object-cover object-center"
          loading="lazy"
        />
        <div className="absolute left-3 top-3 rounded-full border-2 border-black bg-offwhite px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]">
          {active.title}
        </div>
      </div>

      <p className="min-h-10 text-sm text-black/70">{active.subtitle}</p>

      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {SLIDES.map((slide, index) => (
          <span
            key={slide.title}
            className={`h-2.5 w-2.5 rounded-full border border-black ${
              index === activeIndex ? "bg-black" : "bg-offwhite"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

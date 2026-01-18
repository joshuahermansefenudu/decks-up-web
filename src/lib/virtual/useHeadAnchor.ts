"use client"

import * as React from "react"
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"

type HeadAnchor = {
  x: number
  y: number
  visible: boolean
}

const LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-assets/face_landmarker.task"
const LANDMARKER_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"

let landmarkerPromise: Promise<FaceLandmarker> | null = null

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(LANDMARKER_WASM_URL)
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: LANDMARKER_MODEL_URL },
        runningMode: "VIDEO",
        numFaces: 1,
      })
    })()
  }
  return landmarkerPromise
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

export function useHeadAnchor(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean
): HeadAnchor {
  const [anchor, setAnchor] = React.useState<HeadAnchor>({
    x: 0,
    y: 0,
    visible: false,
  })
  const anchorRef = React.useRef<HeadAnchor>(anchor)
  const lastDetectRef = React.useRef(0)
  const lastSeenRef = React.useRef(0)
  const landmarkerRef = React.useRef<FaceLandmarker | null>(null)

  React.useEffect(() => {
    anchorRef.current = anchor
  }, [anchor])

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return
    }

    let isActive = true

    getLandmarker()
      .then((landmarker) => {
        if (isActive) {
          landmarkerRef.current = landmarker
        }
      })
      .catch(() => {
        landmarkerRef.current = null
      })

    const tick = () => {
      if (!isActive) {
        return
      }

      const video = videoRef.current
      const landmarker = landmarkerRef.current

      if (!video || !landmarker || document.visibilityState !== "visible") {
        requestAnimationFrame(tick)
        return
      }

      if (video.readyState < 2) {
        requestAnimationFrame(tick)
        return
      }

      const now = performance.now()
      if (now - lastDetectRef.current < 66) {
        requestAnimationFrame(tick)
        return
      }
      lastDetectRef.current = now

      const bounds = video.getBoundingClientRect()
      const width = bounds.width
      const height = bounds.height
      if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(tick)
        return
      }
      if (!width || !height) {
        requestAnimationFrame(tick)
        return
      }

      const fallbackX = width * 0.5
      const fallbackY = height * 0.22

      let landmarks: { x: number; y: number }[] | undefined
      try {
        const result = landmarker.detectForVideo(video, now)
        landmarks = result.faceLandmarks?.[0]
      } catch {
        requestAnimationFrame(tick)
        return
      }

      if (landmarks && landmarks.length > 0) {
        let minY = 1
        let sumX = 0
        for (const point of landmarks) {
          if (point.y < minY) {
            minY = point.y
          }
          sumX += point.x
        }
        const avgX = sumX / landmarks.length
        const anchorX = avgX * width
        const anchorY = minY * height - height * 0.1

        const nextX = Math.min(width, Math.max(0, anchorX))
        const nextY = Math.min(height, Math.max(0, anchorY))

        const smoothX =
          anchorRef.current.x === 0
            ? nextX
            : lerp(anchorRef.current.x, nextX, 0.2)
        const smoothY =
          anchorRef.current.y === 0
            ? nextY
            : lerp(anchorRef.current.y, nextY, 0.2)

        lastSeenRef.current = now
        const nextAnchor = { x: smoothX, y: smoothY, visible: true }
        anchorRef.current = nextAnchor
        setAnchor(nextAnchor)
      } else if (now - lastSeenRef.current > 500) {
        const nextAnchor = {
          x: fallbackX,
          y: fallbackY,
          visible: false,
        }
        anchorRef.current = nextAnchor
        setAnchor(nextAnchor)
      }

      requestAnimationFrame(tick)
    }

    const rafId = requestAnimationFrame(tick)

    return () => {
      isActive = false
      cancelAnimationFrame(rafId)
    }
  }, [enabled, videoRef])

  return anchor
}

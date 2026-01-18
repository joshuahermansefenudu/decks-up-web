"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

const MAX_PHOTOS = 5

type UploadedPhoto = {
  id: string
  title: string
  publicUrl: string
  createdAt: string
}

type PhotoItem = {
  id: string
  file: File
  status: "pending" | "uploading" | "error"
  error?: string
}

type LobbyUploaderProps = {
  lobbyCode: string
  playerId?: string
  initialPhotos?: UploadedPhoto[]
  totalPhotos?: number
  isHost?: boolean
  lobbyStatus?: string
}

function LobbyUploader({
  lobbyCode,
  playerId,
  initialPhotos = [],
  totalPhotos = 0,
  isHost = false,
  lobbyStatus = "LOBBY",
}: LobbyUploaderProps) {
  const router = useRouter()
  const [items, setItems] = React.useState<PhotoItem[]>([])
  const [limitMessage, setLimitMessage] = React.useState("")
  const [uploadedPhotos, setUploadedPhotos] = React.useState<UploadedPhoto[]>(
    initialPhotos
  )
  const [removeErrors, setRemoveErrors] = React.useState<Record<string, string>>(
    {}
  )
  const [removingIds, setRemovingIds] = React.useState<string[]>([])
  const [startError, setStartError] = React.useState("")
  const [isStarting, setIsStarting] = React.useState(false)

  React.useEffect(() => {
    setUploadedPhotos(initialPhotos)
  }, [initialPhotos])

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setItems((current) => {
      const slots = MAX_PHOTOS - (current.length + uploadedPhotos.length)
      const accepted = files.slice(0, Math.max(slots, 0))
      setLimitMessage(
        accepted.length < files.length
          ? "Only five photos are allowed for now."
          : ""
      )

      const nextItems = accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending" as const,
      }))

      return [...current, ...nextItems]
    })

    event.target.value = ""
  }

  const handleUpload = async (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId)
    if (!item) {
      return
    }

    if (!playerId) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                status: "error",
                error: "Missing player id.",
              }
            : entry
        )
      )
      return
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              status: "uploading",
              error: undefined,
            }
          : entry
      )
    )

    const formData = new FormData()
    formData.append("file", item.file)
    formData.append("lobbyCode", lobbyCode)
    formData.append("playerId", playerId)

    try {
      const response = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === itemId
              ? {
                  ...entry,
                  status: "error",
                  error: payload?.error ?? "Upload failed.",
                }
              : entry
          )
        )
        return
      }

      setUploadedPhotos((current) => [...current, payload.photo])
      setItems((current) => current.filter((entry) => entry.id !== itemId))
      router.refresh()
    } catch {
      setItems((current) =>
        current.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                status: "error",
                error: "Upload failed.",
              }
            : entry
        )
      )
    }
  }

  const totalSelected = items.length + uploadedPhotos.length
  const isAtLimit = totalSelected >= MAX_PHOTOS
  const canStartGame =
    isHost && lobbyStatus === "LOBBY" && totalPhotos >= 1 && Boolean(playerId)

  const handleRemoveUploaded = async (photoId: string) => {
    if (!playerId) {
      setRemoveErrors((current) => ({
        ...current,
        [photoId]: "Missing player id.",
      }))
      return
    }

    if (lobbyStatus !== "LOBBY") {
      setRemoveErrors((current) => ({
        ...current,
        [photoId]: "You can only remove photos before the game starts.",
      }))
      return
    }

    setRemoveErrors((current) => ({ ...current, [photoId]: "" }))
    setRemovingIds((current) => [...current, photoId])

    try {
      const response = await fetch("/api/photos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, lobbyCode, playerId }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setRemoveErrors((current) => ({
          ...current,
          [photoId]: payload?.error ?? "Unable to remove photo.",
        }))
        return
      }

      setUploadedPhotos((current) =>
        current.filter((photo) => photo.id !== photoId)
      )
      router.refresh()
    } catch {
      setRemoveErrors((current) => ({
        ...current,
        [photoId]: "Unable to remove photo.",
      }))
    } finally {
      setRemovingIds((current) => current.filter((id) => id !== photoId))
    }
  }

  const handleStartGame = async () => {
    if (!playerId) {
      setStartError("Missing player id.")
      return
    }

    setStartError("")
    setIsStarting(true)

    try {
      const response = await fetch("/api/lobbies/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyCode, playerId }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStartError(payload?.error ?? "Unable to start game.")
        return
      }

      router.push(`/game/${lobbyCode}?playerId=${playerId}`)
    } catch {
      setStartError("Unable to start game.")
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle>Upload your cards</CardTitle>
          <CardDescription>
            Add up to five photos.
          </CardDescription>
        </div>
        <Badge variant="outline">
          {totalSelected}/5
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          disabled={isAtLimit}
          className="w-full cursor-pointer rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-sm font-medium shadow-[3px_3px_0_#000] file:mr-4 file:rounded-full file:border-2 file:border-black file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-black file:shadow-[2px_2px_0_#000] disabled:cursor-not-allowed disabled:opacity-60"
        />
        {limitMessage ? (
          <p className="text-sm font-semibold text-black">{limitMessage}</p>
        ) : null}

        {uploadedPhotos.length > 0 ? (
          <div className="flex flex-col gap-3">
            {uploadedPhotos.map((photo, index) => (
              <div
                key={photo.id}
                className="flex items-center gap-3 rounded-xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]"
              >
                <img
                  src={photo.publicUrl}
                  alt={photo.title || `Photo ${index + 1}`}
                  className="h-12 w-12 rounded-lg border-2 border-black object-cover"
                  loading="lazy"
                />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Uploaded
                  </p>
                  {removeErrors[photo.id] ? (
                    <p className="mt-1 text-xs font-semibold text-black">
                      {removeErrors[photo.id]}
                    </p>
                  ) : null}
                </div>
                <div className="ml-auto">
                  <SecondaryButton
                    type="button"
                    className="px-3 py-1 text-xs"
                    disabled={
                      removingIds.includes(photo.id) ||
                      lobbyStatus !== "LOBBY"
                    }
                    onClick={() => handleRemoveUploaded(photo.id)}
                  >
                    {removingIds.includes(photo.id) ? "Removing..." : "Remove"}
                  </SecondaryButton>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {items.length === 0 && uploadedPhotos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-black/60 bg-lightgray/60 p-4 text-sm text-black/70">
            No photos yet. Add at least one to enable Start Game.
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="flex flex-col gap-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border-2 border-black bg-lightgray px-4 py-3 shadow-[3px_3px_0_#000]"
              >
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Photo {index + 1}
                </p>
                <p className="text-sm font-medium text-black/80">
                  {item.file.name}
                </p>
                {item.error ? (
                  <p className="mt-2 text-sm font-semibold text-black">
                    {item.error}
                  </p>
                ) : null}
                <PrimaryButton
                  type="button"
                  className="mt-3 w-full"
                  disabled={item.status === "uploading"}
                  onClick={() => handleUpload(item.id)}
                >
                  {item.status === "uploading" ? "Uploading..." : "Upload"}
                </PrimaryButton>
              </div>
            ))}
          </div>
        ) : null}

        <PrimaryButton
          type="button"
          disabled={!canStartGame || isStarting}
          onClick={handleStartGame}
          title={!isHost ? "Only host can start" : undefined}
        >
          {isStarting ? "Starting..." : "Start Game"}
        </PrimaryButton>
        {!isHost ? (
          <p className="text-xs font-semibold text-black/70">
            Only the host can start the game.
          </p>
        ) : null}
        {lobbyStatus !== "LOBBY" ? (
          <p className="text-xs font-semibold text-black/70">
            Game already started.
          </p>
        ) : null}
        {totalPhotos < 1 ? (
          <p className="text-xs font-semibold text-black/70">
            Add at least one photo to start.
          </p>
        ) : null}
        {startError ? (
          <p className="text-sm font-semibold text-black">{startError}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { LobbyUploader }

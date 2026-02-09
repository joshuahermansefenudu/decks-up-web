"use client"

import Link from "next/link"
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
import { supabaseBrowser } from "@/lib/supabase-browser"

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
  status: "uploading" | "error"
  error?: string
}

type AccountPhoto = {
  id: string
  publicUrl: string
  createdAt: string
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
  const [accountPhotos, setAccountPhotos] = React.useState<AccountPhoto[]>([])
  const [accountToken, setAccountToken] = React.useState("")
  const [accountError, setAccountError] = React.useState("")
  const [isAccountLoading, setIsAccountLoading] = React.useState(true)
  const [usingPhotoIds, setUsingPhotoIds] = React.useState<string[]>([])
  const [removingIds, setRemovingIds] = React.useState<string[]>([])
  const [startError, setStartError] = React.useState("")
  const [isStarting, setIsStarting] = React.useState(false)

  React.useEffect(() => {
    setUploadedPhotos(initialPhotos)
  }, [initialPhotos])

  React.useEffect(() => {
    let isMounted = true

    const syncSession = async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (!isMounted) {
        return
      }
      setAccountToken(data.session?.access_token ?? "")
      setIsAccountLoading(false)
    }

    void syncSession()

    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange(
      (_event, session) => {
        setAccountToken(session?.access_token ?? "")
      }
    )

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const fetchAccountPhotos = React.useCallback(async () => {
    if (!accountToken) {
      setAccountPhotos([])
      setAccountError("")
      setIsAccountLoading(false)
      return
    }

    setIsAccountLoading(true)
    setAccountError("")

    try {
      const response = await fetch("/api/account/photos", {
        headers: {
          Authorization: `Bearer ${accountToken}`,
        },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAccountError(payload?.error ?? "Unable to load saved photos.")
        setAccountPhotos([])
        return
      }

      setAccountPhotos(Array.isArray(payload?.photos) ? payload.photos : [])
    } catch {
      setAccountError("Unable to load saved photos.")
      setAccountPhotos([])
    } finally {
      setIsAccountLoading(false)
    }
  }, [accountToken])

  React.useEffect(() => {
    void fetchAccountPhotos()
  }, [fetchAccountPhotos])

  const uploadFile = React.useCallback(
    async (itemId: string, file: File) => {
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
      formData.append("file", file)
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
    },
    [lobbyCode, playerId, router]
  )

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const slots = MAX_PHOTOS - (items.length + uploadedPhotos.length)
    const accepted = files.slice(0, Math.max(slots, 0))
    setLimitMessage(
      accepted.length < files.length ? "Only five photos are allowed for now." : ""
    )

    if (accepted.length === 0) {
      event.target.value = ""
      return
    }

    const nextItems = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "uploading" as const,
    }))

    setItems((current) => [...current, ...nextItems])
    nextItems.forEach((item) => {
      void uploadFile(item.id, item.file)
    })

    event.target.value = ""
  }

  const totalSelected = items.length + uploadedPhotos.length
  const isAtLimit = totalSelected >= MAX_PHOTOS
  const canStartGame =
    isHost && lobbyStatus === "LOBBY" && totalPhotos >= 1 && Boolean(playerId)

  const handleUseSavedPhoto = async (savedPhotoId: string) => {
    if (!playerId) {
      setAccountError("Missing player id.")
      return
    }

    if (!accountToken) {
      setAccountError("Sign in to use saved photos.")
      return
    }

    if (items.length + uploadedPhotos.length >= MAX_PHOTOS) {
      setLimitMessage("Only five photos are allowed for now.")
      return
    }

    setAccountError("")
    setUsingPhotoIds((current) => [...current, savedPhotoId])

    try {
      const response = await fetch("/api/photos/from-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accountToken}`,
        },
        body: JSON.stringify({
          libraryPhotoId: savedPhotoId,
          lobbyCode,
          playerId,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAccountError(payload?.error ?? "Unable to use saved photo.")
        return
      }

      setUploadedPhotos((current) => [...current, payload.photo])
      router.refresh()
    } catch {
      setAccountError("Unable to use saved photo.")
    } finally {
      setUsingPhotoIds((current) => current.filter((id) => id !== savedPhotoId))
    }
  }

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

        <div className="rounded-xl border-2 border-black bg-offwhite p-4 shadow-[3px_3px_0_#000]">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
            Saved account photos
          </p>
          {!accountToken ? (
            <p className="mt-2 text-sm text-black/70">
              Sign in on the{" "}
              <Link href="/account" className="font-semibold underline">
                Account page
              </Link>{" "}
              to reuse photos in lobbies.
            </p>
          ) : isAccountLoading ? (
            <p className="mt-2 text-sm text-black/70">Loading saved photos...</p>
          ) : accountPhotos.length === 0 ? (
            <p className="mt-2 text-sm text-black/70">
              No saved photos yet. Upload some in your account.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {accountPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="rounded-xl border-2 border-black bg-lightgray p-2 shadow-[2px_2px_0_#000]"
                >
                  <img
                    src={photo.publicUrl}
                    alt="Saved account photo"
                    className="h-20 w-full rounded-lg border-2 border-black object-cover"
                    loading="lazy"
                  />
                  <SecondaryButton
                    type="button"
                    className="mt-2 w-full px-2 py-1 text-xs"
                    disabled={
                      usingPhotoIds.includes(photo.id) ||
                      items.length + uploadedPhotos.length >= MAX_PHOTOS
                    }
                    onClick={() => void handleUseSavedPhoto(photo.id)}
                  >
                    {usingPhotoIds.includes(photo.id) ? "Adding..." : "Use photo"}
                  </SecondaryButton>
                </div>
              ))}
            </div>
          )}
          {accountError ? (
            <p className="mt-3 text-sm font-semibold text-black">{accountError}</p>
          ) : null}
        </div>

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
                {item.status === "uploading" ? (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-black/70">
                    Uploading...
                  </p>
                ) : null}
                {item.error ? (
                  <p className="mt-2 text-sm font-semibold text-black">
                    {item.error}
                  </p>
                ) : null}
                {item.status === "error" ? (
                  <SecondaryButton
                    type="button"
                    className="mt-3 w-full"
                    onClick={() => void uploadFile(item.id, item.file)}
                  >
                    Retry upload
                  </SecondaryButton>
                ) : null}
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

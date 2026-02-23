"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import type { Session } from "@supabase/supabase-js"

import { PageContainer } from "@/components/layout/page-container"
import { Stack } from "@/components/layout/stack"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"
import { RelayPurchaseOverlay } from "@/components/payments/relay-purchase-overlay"
import { supabaseBrowser } from "@/lib/supabase-browser"

type AccountPhoto = {
  id: string
  publicUrl: string
  createdAt: string
}

type RelayProfile = {
  planType: "FREE" | "CORE" | "PRO"
  monthlyHours: number
  bankedHours: number
  totalAvailableHours: number
  loyaltyActive: boolean
  renewalPriceUsd: number
  lowCreditWarning: boolean
  expiringHoursWithin7Days: number
  expiringInDays: number | null
}

type BillingSubscriptionSummary = {
  stripeSubscriptionId: string
  stripePriceId: string
  planType: "FREE" | "CORE" | "PRO"
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  isStripeManaged: boolean
}

export default function AccountPage() {
  const router = useRouter()
  const [session, setSession] = React.useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = React.useState(true)
  const [photos, setPhotos] = React.useState<AccountPhoto[]>([])
  const [isPhotosLoading, setIsPhotosLoading] = React.useState(false)
  const [photoError, setPhotoError] = React.useState("")
  const [uploadingIds, setUploadingIds] = React.useState<string[]>([])
  const [deletingIds, setDeletingIds] = React.useState<string[]>([])
  const [nextPath, setNextPath] = React.useState<"" | "/join" | "/create">("")
  const [relayProfile, setRelayProfile] = React.useState<RelayProfile | null>(
    null
  )
  const [subscriptionSummary, setSubscriptionSummary] =
    React.useState<BillingSubscriptionSummary | null>(null)
  const [hasActiveSubscription, setHasActiveSubscription] =
    React.useState(false)
  const [isPurchaseOverlayOpen, setIsPurchaseOverlayOpen] =
    React.useState(false)
  const [relayError, setRelayError] = React.useState("")

  const accessToken = session?.access_token ?? ""
  const nextLabel = nextPath === "/join" ? "Join Game" : "Create Game"

  React.useEffect(() => {
    let isMounted = true

    const init = async () => {
      const { data } = await supabaseBrowser.auth.getSession()
      if (!isMounted) {
        return
      }
      setSession(data.session ?? null)
      setIsSessionLoading(false)
    }

    void init()

    const params = new URLSearchParams(window.location.search)
    const next = params.get("next")
    setNextPath(next === "/join" || next === "/create" ? next : "")

    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession)
      }
    )

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const fetchPhotos = React.useCallback(async () => {
    if (!accessToken) {
      setPhotos([])
      return
    }

    setIsPhotosLoading(true)
    setPhotoError("")

    try {
      const response = await fetch("/api/account/photos", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setPhotoError(payload?.error ?? "Unable to load your photos.")
        setPhotos([])
        return
      }

      setPhotos(Array.isArray(payload?.photos) ? payload.photos : [])
    } catch {
      setPhotoError("Unable to load your photos.")
      setPhotos([])
    } finally {
      setIsPhotosLoading(false)
    }
  }, [accessToken])

  const fetchRelayProfile = React.useCallback(async () => {
    if (!accessToken) {
      setRelayProfile(null)
      setSubscriptionSummary(null)
      setHasActiveSubscription(false)
      setRelayError("")
      return
    }

    try {
      const response = await fetch("/api/payments/subscription", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => ({}))) as {
        relayProfile?: RelayProfile
        subscription?: BillingSubscriptionSummary | null
        error?: string
      }
      if (!response.ok) {
        setRelayError(payload?.error ?? "Unable to load relay profile.")
        setRelayProfile(null)
        setSubscriptionSummary(null)
        setHasActiveSubscription(false)
        return
      }
      const subscriptionStatus = payload.subscription?.status?.toUpperCase() ?? ""
      setRelayProfile(payload?.relayProfile ?? null)
      setSubscriptionSummary(payload?.subscription ?? null)
      setHasActiveSubscription(
        Boolean(payload?.subscription) &&
          subscriptionStatus !== "CANCELED" &&
          subscriptionStatus !== "UNPAID"
      )
      setRelayError("")
    } catch {
      setRelayError("Unable to load relay profile.")
      setRelayProfile(null)
      setSubscriptionSummary(null)
      setHasActiveSubscription(false)
    }
  }, [accessToken])

  React.useEffect(() => {
    void fetchPhotos()
  }, [fetchPhotos])

  React.useEffect(() => {
    void fetchRelayProfile()
  }, [fetchRelayProfile])

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut()
    setPhotos([])
    router.refresh()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!accessToken || files.length === 0) {
      return
    }

    setPhotoError("")
    const pendingIds = files.map(() => crypto.randomUUID())
    setUploadingIds((current) => [...current, ...pendingIds])

    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/account/photos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          setPhotoError(payload?.error ?? "Unable to upload photo.")
          break
        }
      }
      await fetchPhotos()
    } catch {
      setPhotoError("Unable to upload photo.")
    } finally {
      setUploadingIds((current) =>
        current.filter((id) => !pendingIds.includes(id))
      )
      event.target.value = ""
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!accessToken) {
      return
    }

    setPhotoError("")
    setDeletingIds((current) => [...current, photoId])

    try {
      const response = await fetch("/api/account/photos", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ photoId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPhotoError(payload?.error ?? "Unable to delete photo.")
        return
      }

      setPhotos((current) => current.filter((photo) => photo.id !== photoId))
    } catch {
      setPhotoError("Unable to delete photo.")
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== photoId))
    }
  }

  const loginHref = nextPath
    ? `/account/login?next=${encodeURIComponent(nextPath)}`
    : "/account/login"
  const signupHref = nextPath
    ? `/account/signup?next=${encodeURIComponent(nextPath)}`
    : "/account/signup"

  return (
    <PageContainer>
      <Stack className="gap-6">
        <RelayPurchaseOverlay
          open={isPurchaseOverlayOpen}
          originContext="account"
          originPath="/account"
          isAuthenticated={Boolean(session)}
          accessToken={accessToken}
          currentPlanType={relayProfile?.planType ?? "FREE"}
          hasActiveSubscription={hasActiveSubscription}
          onClose={() => setIsPurchaseOverlayOpen(false)}
          onRequireSignIn={() => {
            router.push(loginHref)
          }}
          onCompleted={async () => {
            await fetchRelayProfile()
          }}
        />
        <header className="space-y-2">
          <h1 className="font-display text-3xl uppercase tracking-wide">
            Account
          </h1>
          <p className="text-sm text-black/70">
            Create an account to save and reuse photos, or continue as a guest.
          </p>
        </header>

        {isSessionLoading ? (
          <Card>
            <CardContent className="py-6 text-sm text-black/70">
              Loading session...
            </CardContent>
          </Card>
        ) : !session ? (
          <Card>
            <CardHeader>
              <CardTitle>Account access</CardTitle>
              <CardDescription>
                Choose login or create account to unlock saved photo features.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <PrimaryButton asChild className="w-full">
                <Link href={loginHref}>Login</Link>
              </PrimaryButton>
              <SecondaryButton asChild className="w-full">
                <Link href={signupHref}>Create Account</Link>
              </SecondaryButton>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Signed in</CardTitle>
                <CardDescription>{session.user.email}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {nextPath ? (
                  <PrimaryButton asChild className="w-full">
                    <Link href={nextPath}>Continue to {nextLabel}</Link>
                  </PrimaryButton>
                ) : null}
                <SecondaryButton type="button" onClick={handleSignOut}>
                  Sign out
                </SecondaryButton>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Manage password or permanently delete your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <PrimaryButton asChild className="w-full">
                  <Link href="/account/update-password">Update Password</Link>
                </PrimaryButton>
                <SecondaryButton asChild className="w-full">
                  <Link href="/account/delete-account">Delete Account</Link>
                </SecondaryButton>
                <p className="text-sm text-black/70">
                  Warning: deleting your account permanently removes your saved
                  pictures.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relay hours</CardTitle>
                <CardDescription>
                  Plan and banked relay hours for virtual fallback.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-black/80">
                {relayProfile ? (
                  <>
                    <p>
                      Plan:{" "}
                      <span className="font-semibold">{relayProfile.planType}</span>
                    </p>
                    <p>
                      Total available:{" "}
                      <span className="font-semibold">
                        {relayProfile.totalAvailableHours.toFixed(2)}h
                      </span>
                    </p>
                    <p>
                      Banked hours:{" "}
                      <span className="font-semibold">
                        {relayProfile.bankedHours.toFixed(2)}h
                      </span>
                    </p>
                    {relayProfile.lowCreditWarning ? (
                      <p className="rounded-xl border-2 border-black bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]">
                        Low Relay Hours - Upgrade or Buy Credits
                      </p>
                    ) : null}
                    {relayProfile.expiringHoursWithin7Days > 0 ? (
                      <p className="rounded-xl border-2 border-black bg-lightgray px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]">
                        Banked hours expire in{" "}
                        {relayProfile.expiringInDays ?? "<7"} days.
                      </p>
                    ) : null}
                    {subscriptionSummary ? (
                      <p className="rounded-xl border-2 border-black bg-lightgray px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]">
                        Stripe status: {subscriptionSummary.status}
                        {subscriptionSummary.cancelAtPeriodEnd
                          ? " (ends at period end)"
                          : ""}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-black/70">No relay plan yet.</p>
                )}
                {relayError ? (
                  <p className="text-sm font-semibold text-black">{relayError}</p>
                ) : null}
                <PrimaryButton
                  type="button"
                  className="w-full"
                  onClick={() => setIsPurchaseOverlayOpen(true)}
                >
                  {hasActiveSubscription
                    ? "Manage Subscription"
                    : "Subscribe / Buy Relay Hours"}
                </PrimaryButton>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved photos</CardTitle>
                <CardDescription>
                  Upload once and reuse these in future lobbies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUpload}
                  disabled={uploadingIds.length > 0}
                  className="w-full cursor-pointer rounded-xl border-2 border-black bg-offwhite px-3 py-2 text-sm font-medium shadow-[3px_3px_0_#000] file:mr-4 file:rounded-full file:border-2 file:border-black file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-black file:shadow-[2px_2px_0_#000] disabled:cursor-not-allowed disabled:opacity-60"
                />
                {uploadingIds.length > 0 ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
                    Uploading...
                  </p>
                ) : null}
                {isPhotosLoading ? (
                  <p className="text-sm text-black/70">Loading photos...</p>
                ) : photos.length === 0 ? (
                  <p className="text-sm text-black/70">No saved photos yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="rounded-xl border-2 border-black bg-lightgray p-2 shadow-[3px_3px_0_#000]"
                      >
                        <img
                          src={photo.publicUrl}
                          alt="Saved account photo"
                          className="h-28 w-full rounded-lg border-2 border-black object-cover"
                          loading="lazy"
                        />
                        <SecondaryButton
                          type="button"
                          className="mt-2 w-full px-2 py-1 text-xs"
                          onClick={() => handleDeletePhoto(photo.id)}
                          disabled={deletingIds.includes(photo.id)}
                        >
                          {deletingIds.includes(photo.id)
                            ? "Removing..."
                            : "Remove"}
                        </SecondaryButton>
                      </div>
                    ))}
                  </div>
                )}
                {photoError ? (
                  <p className="text-sm font-semibold text-black">{photoError}</p>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}

        <SecondaryButton asChild className="w-full">
          <Link href="/">Back Home</Link>
        </SecondaryButton>
      </Stack>
    </PageContainer>
  )
}

import { PlanBadge, type PlanType } from "@/components/ui/plan-badge"

type RelayRoomState = {
  relayEnabled: boolean
  relayStatus: "PENDING" | "APPROVED" | "DENIED" | "ACTIVE" | "ENDED" | "NONE"
  activeVideoParticipants: number
  burnRatePerMinute: number
  remainingHostHours: number
  hostPlanType: PlanType
  relayDisabledReason: string | null
  maxRelayParticipants: number
  activeRequesterPlayerId: string | null
  pendingRequest?: {
    requestId: string
    requesterPlayerId: string
    requesterName: string
    estimatedBurnRatePerMinute: number
  } | null
}

type RelayViewerState = {
  planType: PlanType
  canEnableRelay: boolean
  canRequestRelay: boolean
  totalAvailableHours: number
  lowCreditWarning: boolean
  expiringSoonWarning: boolean
  expiringHoursWithin7Days: number
  expiringInDays: number | null
}

type RelayStatusPanelProps = {
  room: RelayRoomState | null
  viewer: RelayViewerState | null
  relayActive: boolean
  isTurnUnlocked: boolean
}

function round2(value: number) {
  return Number(value.toFixed(2))
}

function getStatusText(props: RelayStatusPanelProps): string {
  const { room, viewer, relayActive, isTurnUnlocked } = props
  if (relayActive || (room?.relayEnabled && room.relayStatus !== "DENIED")) {
    return `Relay Active - ${round2(room?.remainingHostHours ?? 0)}h remaining`
  }

  if (!isTurnUnlocked) {
    return "Direct P2P Connection"
  }

  if (
    room?.relayDisabledReason === "no_credits" &&
    !viewer?.canEnableRelay &&
    !viewer?.canRequestRelay
  ) {
    return "Relay Disabled - No Credits"
  }

  if (viewer?.canEnableRelay || viewer?.canRequestRelay) {
    return "Relay Available"
  }

  return "Direct P2P Connection"
}

function RelayStatusPanel({
  room,
  viewer,
  relayActive,
  isTurnUnlocked,
}: RelayStatusPanelProps) {
  const statusText = getStatusText({
    room,
    viewer,
    relayActive,
    isTurnUnlocked,
  })

  const burnRate = room?.burnRatePerMinute ?? 0
  const remaining = room?.remainingHostHours ?? viewer?.totalAvailableHours ?? 0
  const usagePercent =
    burnRate > 0 ? Math.min(100, Math.max(10, Math.round(burnRate * 20))) : 0

  return (
    <section
      className="rounded-2xl border-2 border-black bg-offwhite px-4 py-3 shadow-[3px_3px_0_#000]"
      aria-label="Relay status panel"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
          Relay status
        </p>
        <div className="flex items-center gap-2">
          <PlanBadge planType={viewer?.planType ?? "FREE"} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-black/70">
            Host
          </span>
          <PlanBadge planType={room?.hostPlanType ?? "FREE"} />
        </div>
      </div>

      <p className="mt-2 text-sm font-semibold text-black">{statusText}</p>

      <div className="mt-3 grid gap-2 text-[11px] font-semibold uppercase tracking-wide text-black/70 sm:grid-cols-3">
        <p>Remaining: {round2(remaining)}h</p>
        <p>Participants: {room?.activeVideoParticipants ?? 0}</p>
        <p>Burn: {round2(burnRate)}/min</p>
      </div>

      <div className="mt-2 h-3 w-full rounded-full border-2 border-black bg-lightgray">
        <div
          className={`h-full rounded-full ${
            burnRate > 1 ? "bg-black" : "bg-primary"
          }`}
          style={{ width: `${usagePercent}%` }}
        />
      </div>
    </section>
  )
}

export { RelayStatusPanel }
export type { RelayRoomState, RelayViewerState }

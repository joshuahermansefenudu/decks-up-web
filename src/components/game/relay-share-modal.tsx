"use client"

import { PlanBadge, type PlanType } from "@/components/ui/plan-badge"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

type RelayShareCandidate = {
  playerId: string
  name: string
  planType: PlanType
  alreadySharedByViewer: boolean
}

type RelayShareModalProps = {
  open: boolean
  candidates: RelayShareCandidate[]
  selectedPlayerIds: string[]
  sharerHours: number
  isSubmitting: boolean
  onClose: () => void
  onTogglePlayer: (playerId: string) => void
  onSelectAll: () => void
  onClear: () => void
  onSubmit: () => void
}

function RelayShareModal({
  open,
  candidates,
  selectedPlayerIds,
  sharerHours,
  isSubmitting,
  onClose,
  onTogglePlayer,
  onSelectAll,
  onClear,
  onSubmit,
}: RelayShareModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-3xl border-2 border-black bg-offwhite p-5 shadow-[6px_6px_0_#000]">
        <h2 className="font-display text-2xl uppercase tracking-wide text-black">
          Share Relay Hours
        </h2>
        <p className="mt-2 text-sm text-black/80">
          Choose which players can use your relay hours if direct video fails.
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-black/70">
          Your available hours: {sharerHours.toFixed(2)}h
        </p>

        <div className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1">
          {candidates.length === 0 ? (
            <p className="rounded-xl border-2 border-black bg-lightgray px-3 py-2 text-xs font-semibold uppercase tracking-wide text-black/70">
              Everyone already has relay hours.
            </p>
          ) : (
            candidates.map((candidate) => {
              const checked = selectedPlayerIds.includes(candidate.playerId)
              return (
                <label
                  key={candidate.playerId}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-black bg-lightgray px-3 py-2 shadow-[2px_2px_0_#000]"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onTogglePlayer(candidate.playerId)}
                      className="h-4 w-4 accent-black"
                    />
                    <div>
                      <p className="text-sm font-semibold text-black">{candidate.name}</p>
                      {candidate.alreadySharedByViewer ? (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-black/60">
                          Already approved
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <PlanBadge planType={candidate.planType} />
                </label>
              )
            })
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            className="px-3 py-1 text-xs"
            onClick={onSelectAll}
            disabled={isSubmitting || candidates.length === 0}
          >
            Select All
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="px-3 py-1 text-xs"
            onClick={onClear}
            disabled={isSubmitting || selectedPlayerIds.length === 0}
          >
            Clear
          </SecondaryButton>
        </div>

        <div className="mt-5 flex gap-3">
          <PrimaryButton
            type="button"
            className="w-full"
            disabled={isSubmitting || selectedPlayerIds.length === 0}
            onClick={onSubmit}
          >
            {isSubmitting ? "Sharing..." : "Share with selected"}
          </PrimaryButton>
          <SecondaryButton type="button" className="w-full" onClick={onClose}>
            Close
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}

export { RelayShareModal }

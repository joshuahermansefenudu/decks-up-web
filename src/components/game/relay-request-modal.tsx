"use client"

import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

type RelayRequestModalProps = {
  open: boolean
  requesterName: string
  estimatedBurnRatePerMinute: number
  remainingHostHours: number
  isSubmitting: boolean
  onApprove: () => void
  onDeny: () => void
}

function RelayRequestModal({
  open,
  requesterName,
  estimatedBurnRatePerMinute,
  remainingHostHours,
  isSubmitting,
  onApprove,
  onDeny,
}: RelayRequestModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-3xl border-2 border-black bg-offwhite p-5 shadow-[6px_6px_0_#000]">
        <h2 className="font-display text-2xl uppercase tracking-wide text-black">
          Relay Request
        </h2>
        <p className="mt-2 text-sm text-black/80">
          {requesterName} requests to use your relay hours.
        </p>

        <div className="mt-4 rounded-2xl border-2 border-black bg-lightgray p-3 text-xs font-semibold uppercase tracking-wide text-black/80">
          <p>Estimated burn: {estimatedBurnRatePerMinute.toFixed(2)} / min</p>
          <p className="mt-1">Remaining host hours: {remainingHostHours.toFixed(2)}h</p>
        </div>

        <div className="mt-5 flex gap-3">
          <PrimaryButton
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={onApprove}
          >
            Approve
          </PrimaryButton>
          <SecondaryButton
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={onDeny}
          >
            Deny
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}

export { RelayRequestModal }

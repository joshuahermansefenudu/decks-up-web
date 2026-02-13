"use client"

import * as React from "react"

type ErrorDebugPanelProps = {
  message: string
}

function ErrorDebugPanel({ message }: ErrorDebugPanelProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail in unsupported contexts; keep UI silent.
    }
  }

  return (
    <div className="rounded-xl border-2 border-black bg-lightgray p-3 shadow-[3px_3px_0_#000]">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/70">
        Error details
      </p>
      <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg border-2 border-black bg-offwhite p-2 text-xs text-black">
        {message}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-2 rounded-full border-2 border-black bg-offwhite px-3 py-1 text-xs font-semibold uppercase tracking-wide text-black shadow-[2px_2px_0_#000]"
      >
        {copied ? "Copied" : "Copy Error"}
      </button>
    </div>
  )
}

export { ErrorDebugPanel }

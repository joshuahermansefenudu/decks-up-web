"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Copy } from "lucide-react"

type LobbyCodeProps = {
  code: string
}

function LobbyCode({ code }: LobbyCodeProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" onClick={handleCopy} className="text-left">
      <span className="inline-flex items-center gap-2">
        <Badge>{code}</Badge>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-offwhite shadow-[2px_2px_0_#000]">
          <Copy className="h-4 w-4 text-black" />
        </span>
      </span>
      {copied ? (
        <span className="ml-2 text-xs font-semibold text-black/60">
          Copied!
        </span>
      ) : null}
    </button>
  )
}

export { LobbyCode }

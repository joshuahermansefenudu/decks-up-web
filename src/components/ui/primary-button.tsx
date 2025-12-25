import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

type PrimaryButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  asChild?: boolean
}

function PrimaryButton({ className, asChild = false, ...props }: PrimaryButtonProps) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-full border-2 border-black bg-primary px-6 py-3 text-base font-semibold uppercase tracking-wide text-black shadow-[4px_4px_0_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0",
        className
      )}
      {...props}
    />
  )
}

export { PrimaryButton }
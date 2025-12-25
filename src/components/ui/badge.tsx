import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border-2 border-black px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-[2px_2px_0_#000] transition-[color,box-shadow,transform] [&>svg]:pointer-events-none [&>svg]:size-3 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-black [a&]:hover:bg-primary/90",
        secondary:
          "bg-black text-offwhite [a&]:hover:bg-black/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/30",
        outline:
          "bg-offwhite text-black [a&]:hover:bg-lightgray",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

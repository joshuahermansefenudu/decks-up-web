import * as React from "react"

import { cn } from "@/lib/utils"

type StackProps = React.ComponentPropsWithoutRef<"div">

function Stack({ className, ...props }: StackProps) {
  return <div className={cn("flex flex-col gap-4", className)} {...props} />
}

export { Stack }
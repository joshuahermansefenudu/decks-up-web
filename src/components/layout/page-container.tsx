import * as React from "react"

import { cn } from "@/lib/utils"

type PageContainerProps = React.ComponentPropsWithoutRef<"main">

function PageContainer({ className, ...props }: PageContainerProps) {
  return (
    <main
      className={cn("mx-auto w-full max-w-md px-4 pb-12 pt-8", className)}
      {...props}
    />
  )
}

export { PageContainer }
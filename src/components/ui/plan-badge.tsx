import { Badge } from "@/components/ui/badge"

type PlanType = "FREE" | "CORE" | "PRO"

type PlanBadgeProps = {
  planType?: PlanType | null
  className?: string
}

const PLAN_LABEL: Record<PlanType, string> = {
  FREE: "Free",
  CORE: "Core",
  PRO: "Pro",
}

const PLAN_STYLE: Record<PlanType, string> = {
  FREE: "bg-offwhite text-black",
  CORE: "bg-primary text-black",
  PRO: "bg-black text-offwhite",
}

function PlanBadge({ planType, className }: PlanBadgeProps) {
  const normalized: PlanType = planType === "CORE" || planType === "PRO" ? planType : "FREE"

  return (
    <Badge
      variant="outline"
      className={`${PLAN_STYLE[normalized]} ${className ?? ""}`.trim()}
    >
      {PLAN_LABEL[normalized]}
    </Badge>
  )
}

export { PlanBadge }
export type { PlanType }

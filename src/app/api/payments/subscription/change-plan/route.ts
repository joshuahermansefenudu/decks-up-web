import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import {
  changeSubscriptionPlanForUser,
  normalizePriceSelectionError,
} from "@/lib/payments/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    planType?: "CORE" | "PRO"
  }

  if (body.planType !== "CORE" && body.planType !== "PRO") {
    return NextResponse.json({ error: "Invalid plan type." }, { status: 400 })
  }

  try {
    const subscription = await changeSubscriptionPlanForUser({
      userId: user.id,
      nextPlanType: body.planType,
    })
    return NextResponse.json({ subscription })
  } catch (changeError) {
    return NextResponse.json(
      { error: normalizePriceSelectionError(changeError) },
      { status: 400 }
    )
  }
}

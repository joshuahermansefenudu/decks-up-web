import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import {
  cancelSubscriptionForUser,
  normalizePriceSelectionError,
} from "@/lib/payments/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  try {
    const subscription = await cancelSubscriptionForUser(user.id)
    return NextResponse.json({ subscription })
  } catch (cancelError) {
    return NextResponse.json(
      { error: normalizePriceSelectionError(cancelError) },
      { status: 400 }
    )
  }
}

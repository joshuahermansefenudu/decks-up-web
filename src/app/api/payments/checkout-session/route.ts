import { NextResponse } from "next/server"

import { getAuthUser } from "@/lib/auth-user"
import {
  checkCheckoutRateLimit,
  createCheckoutSessionForUser,
  normalizePriceSelectionError,
} from "@/lib/payments/server"

export const runtime = "nodejs"

type CheckoutRequestBody = {
  kind?: "SUBSCRIPTION" | "CREDIT_PACK"
  planType?: "CORE" | "PRO"
  creditPack?: "STARTER" | "STANDARD" | "PARTY"
  originContext?: string
  originPath?: string
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) {
    return forwarded
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export async function POST(request: Request) {
  const { user, error } = await getAuthUser(request)
  if (!user || error) {
    return NextResponse.json({ error: error ?? "Unauthorized." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as CheckoutRequestBody
  const kind = body.kind

  if (kind !== "SUBSCRIPTION" && kind !== "CREDIT_PACK") {
    return NextResponse.json({ error: "Invalid purchase kind." }, { status: 400 })
  }

  if (kind === "SUBSCRIPTION" && body.planType !== "CORE" && body.planType !== "PRO") {
    return NextResponse.json({ error: "Invalid plan type." }, { status: 400 })
  }

  if (
    kind === "CREDIT_PACK" &&
    body.creditPack !== "STARTER" &&
    body.creditPack !== "STANDARD" &&
    body.creditPack !== "PARTY"
  ) {
    return NextResponse.json({ error: "Invalid credit pack." }, { status: 400 })
  }

  const rateLimit = checkCheckoutRateLimit({
    userId: user.id,
    ipAddress: getClientIp(request),
  })
  // TODO(prod-hardening): Add WAF rules, abuse scoring, and per-room checkout caps.
  if (!rateLimit.ok) {
    return NextResponse.json(
      {
        error: `Too many checkout attempts. Retry in ${rateLimit.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    )
  }

  const origin = new URL(request.url).origin

  try {
    const session = await createCheckoutSessionForUser({
      userId: user.id,
      email: user.email,
      kind,
      planType: body.planType,
      creditPack: body.creditPack,
      originContext: body.originContext,
      origin,
      originPath: body.originPath,
    })

    return NextResponse.json(session)
  } catch (checkoutError) {
    const message = normalizePriceSelectionError(checkoutError)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

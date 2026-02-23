import { NextResponse } from "next/server"

import { processStripeWebhook } from "@/lib/payments/server"
import { verifyStripeWebhookEvent } from "@/lib/stripe/webhook"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const rawBody = await request.text()
  // TODO(prod-hardening): Add webhook replay protection monitoring + immutable audit trail export.

  try {
    const event = verifyStripeWebhookEvent(rawBody, signature)
    await processStripeWebhook(event)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("STRIPE_WEBHOOK_ERROR", error)
    return NextResponse.json(
      {
        error: String((error as Error | undefined)?.message ?? error),
      },
      { status: 400 }
    )
  }
}

import Stripe from "stripe"

import { getStripeServerClient } from "@/lib/stripe/server"
import { getStripeWebhookSecret } from "@/lib/stripe/prices"

export function verifyStripeWebhookEvent(rawBody: string, signature: string | null) {
  if (!signature) {
    throw new Error("Missing stripe-signature header")
  }

  const webhookSecret = getStripeWebhookSecret()
  const stripe = getStripeServerClient()
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}

export function isStripeEvent(input: unknown): input is Stripe.Event {
  return typeof input === "object" && input !== null && "id" in input && "type" in input
}

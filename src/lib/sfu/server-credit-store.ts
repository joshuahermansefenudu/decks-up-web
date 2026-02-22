import {
  applyRelayPurchaseForUser,
  getRelayProfile,
  setRelayPlan,
  type RelayProfileSummary,
} from "@/lib/relay/server-relay-pricing"

type CreditAccount = {
  hostId: string
  balanceCredits: number
  reservedCredits: number
  subscription: {
    hostId: string
    planType: string
    monthlyHours: number
    bankedHours: number
    bankCapHours: number
    loyaltyActive: boolean
    renewalPriceUsd: number
    standardPriceUsd: number
    loyaltyPriceUsd: number
  }
  notifications: string[]
}

const globalCreditNotifications = globalThis as unknown as {
  sfuCreditNotifications?: Map<string, string[]>
}

const notificationStore =
  globalCreditNotifications.sfuCreditNotifications ?? new Map<string, string[]>()
globalCreditNotifications.sfuCreditNotifications = notificationStore

function pushNotification(hostId: string, message: string) {
  const current = notificationStore.get(hostId) ?? []
  current.push(message)
  notificationStore.set(hostId, current.slice(-20))
}

function mapSummaryToAccount(
  hostId: string,
  summary: RelayProfileSummary,
  reservedCredits = 0
): CreditAccount {
  const bankCapHours =
    summary.planType === "PRO"
      ? 36
      : summary.planType === "CORE"
        ? 15
        : 0

  return {
    hostId,
    balanceCredits: summary.totalAvailableHours,
    reservedCredits,
    subscription: {
      hostId,
      planType: summary.planType,
      monthlyHours: summary.monthlyHours,
      bankedHours: summary.bankedHours,
      bankCapHours,
      loyaltyActive: summary.loyaltyActive,
      renewalPriceUsd: summary.renewalPriceUsd,
      standardPriceUsd: summary.standardPriceUsd,
      loyaltyPriceUsd: summary.loyaltyPriceUsd,
    },
    notifications: notificationStore.get(hostId) ?? [],
  }
}

const reservedCreditsStore = globalThis as unknown as {
  sfuReservedCredits?: Map<string, number>
}

const reservedMap = reservedCreditsStore.sfuReservedCredits ?? new Map<string, number>()
reservedCreditsStore.sfuReservedCredits = reservedMap

export async function getCreditBalance(hostId: string): Promise<CreditAccount> {
  const summary = await getRelayProfile(hostId)
  if (summary.lowCreditWarning) {
    pushNotification(hostId, "Low relay hours. Upgrade or buy credits soon.")
  }
  if (summary.expiringHoursWithin7Days > 0) {
    pushNotification(
      hostId,
      `Banked hours expiring soon (${summary.expiringHoursWithin7Days.toFixed(2)}h).`
    )
  }
  return mapSummaryToAccount(hostId, summary, reservedMap.get(hostId) ?? 0)
}

export async function reserveCredits(
  hostId: string,
  amountCredits: number
): Promise<CreditAccount> {
  const safeAmount = Math.max(0, Number(amountCredits) || 0)
  const summary = await getRelayProfile(hostId)
  const availableForReserve = Math.max(
    0,
    summary.totalAvailableHours - (reservedMap.get(hostId) ?? 0)
  )
  const reserveAmount = Math.min(availableForReserve, safeAmount)
  reservedMap.set(hostId, roundHours((reservedMap.get(hostId) ?? 0) + reserveAmount))
  return mapSummaryToAccount(hostId, summary, reservedMap.get(hostId) ?? 0)
}

export async function deductCredits(
  hostId: string,
  amountCredits: number
): Promise<CreditAccount> {
  const safeAmount = Math.max(0, Number(amountCredits) || 0)
  const currentReserved = reservedMap.get(hostId) ?? 0
  reservedMap.set(hostId, Math.max(0, roundHours(currentReserved - safeAmount)))

  const summary = await applyRelayPurchaseForUser({ userId: hostId })
  if (summary.totalAvailableHours <= 0) {
    pushNotification(hostId, "Balance exhausted. Relay has been disabled.")
  }
  return mapSummaryToAccount(hostId, summary, reservedMap.get(hostId) ?? 0)
}

export async function releaseCredits(
  hostId: string,
  amountCredits: number
): Promise<CreditAccount> {
  const safeAmount = Math.max(0, Number(amountCredits) || 0)
  const currentReserved = reservedMap.get(hostId) ?? 0
  reservedMap.set(hostId, Math.max(0, roundHours(currentReserved - safeAmount)))
  const summary = await getRelayProfile(hostId)
  return mapSummaryToAccount(hostId, summary, reservedMap.get(hostId) ?? 0)
}

export async function renewSubscriptionForHost(
  hostId: string
): Promise<CreditAccount> {
  const current = await getRelayProfile(hostId)
  const nextPlan = current.planType
  const summary = await setRelayPlan(hostId, nextPlan)
  const renewalPrice = summary.loyaltyActive
    ? summary.loyaltyPriceUsd
    : summary.standardPriceUsd
  pushNotification(
    hostId,
    `Renewal applied at $${renewalPrice.toFixed(2)} (${summary.planType}).`
  )
  return mapSummaryToAccount(hostId, summary, reservedMap.get(hostId) ?? 0)
}

export function consumeNotifications(hostId: string): string[] {
  const messages = [...(notificationStore.get(hostId) ?? [])]
  notificationStore.set(hostId, [])
  return messages
}

function roundHours(value: number) {
  return Math.max(0, Number(value.toFixed(4)))
}


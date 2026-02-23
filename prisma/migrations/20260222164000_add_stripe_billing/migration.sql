-- CreateEnum
CREATE TYPE "BillingCheckoutKind" AS ENUM ('SUBSCRIPTION', 'CREDIT_PACK');

-- CreateEnum
CREATE TYPE "CreditPackType" AS ENUM ('STARTER', 'STANDARD', 'PARTY');

-- CreateEnum
CREATE TYPE "BillingCheckoutStatus" AS ENUM ('CREATED', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');

-- AlterTable
ALTER TABLE "UserRelayProfile"
ADD COLUMN "isStripeManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeSubscriptionStatus" "BillingSubscriptionStatus";

-- CreateTable
CREATE TABLE "BillingCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCheckoutSession" (
    "id" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BillingCheckoutKind" NOT NULL,
    "planType" "PlanType",
    "creditPack" "CreditPackType",
    "status" "BillingCheckoutStatus" NOT NULL DEFAULT 'CREATED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_userId_key" ON "BillingCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_stripeSubscriptionId_key" ON "BillingSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "BillingSubscription_userId_status_idx" ON "BillingSubscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutSession_stripeCheckoutSessionId_key" ON "BillingCheckoutSession"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "BillingCheckoutSession_userId_kind_status_idx" ON "BillingCheckoutSession"("userId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_eventId_key" ON "StripeWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_eventType_status_idx" ON "StripeWebhookEvent"("eventType", "status");

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserRelayProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserRelayProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutSession" ADD CONSTRAINT "BillingCheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserRelayProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

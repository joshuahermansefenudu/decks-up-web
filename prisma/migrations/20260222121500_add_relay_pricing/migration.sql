-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'CORE', 'PRO');

-- CreateEnum
CREATE TYPE "RelayBucketSource" AS ENUM ('MONTHLY_GRANT', 'CREDIT_PACK');

-- CreateEnum
CREATE TYPE "RelaySessionStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "UserRelayProfile" (
    "userId" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'FREE',
    "monthlyHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankExpiryDate" TIMESTAMP(3),
    "loyaltyActive" BOOLEAN NOT NULL DEFAULT false,
    "lastRenewalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRelayProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RelayHourBucket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "RelayBucketSource" NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "remainingHours" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelayHourBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelaySession" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "requesterPlayerId" TEXT NOT NULL,
    "requesterUserId" TEXT,
    "hostPlayerId" TEXT,
    "hostUserId" TEXT,
    "status" "RelaySessionStatus" NOT NULL DEFAULT 'PENDING',
    "maxMinutesGranted" INTEGER,
    "activeVideoParticipants" INTEGER NOT NULL DEFAULT 0,
    "baseRate" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastDeductedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "RelaySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelayHourBucket_userId_expiresAt_idx" ON "RelayHourBucket"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RelaySession_lobbyId_status_idx" ON "RelaySession"("lobbyId", "status");

-- CreateIndex
CREATE INDEX "RelaySession_hostUserId_status_idx" ON "RelaySession"("hostUserId", "status");

-- CreateIndex
CREATE INDEX "RelaySession_requesterPlayerId_status_idx" ON "RelaySession"("requesterPlayerId", "status");

-- AddForeignKey
ALTER TABLE "RelayHourBucket" ADD CONSTRAINT "RelayHourBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserRelayProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelaySession" ADD CONSTRAINT "RelaySession_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "UserRelayProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelaySession" ADD CONSTRAINT "RelaySession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "UserRelayProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

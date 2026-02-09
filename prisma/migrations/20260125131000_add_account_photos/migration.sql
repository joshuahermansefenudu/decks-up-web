-- CreateTable
CREATE TABLE "AccountPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountPhoto_storagePath_key" ON "AccountPhoto"("storagePath");

-- CreateIndex
CREATE INDEX "AccountPhoto_userId_createdAt_idx" ON "AccountPhoto"("userId", "createdAt");

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "authUserId" TEXT;

-- CreateIndex
CREATE INDEX "Player_authUserId_idx" ON "Player"("authUserId");

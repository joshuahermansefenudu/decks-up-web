-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_lobbyId_idx" ON "Photo"("lobbyId");

-- CreateIndex
CREATE INDEX "Photo_playerId_idx" ON "Photo"("playerId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

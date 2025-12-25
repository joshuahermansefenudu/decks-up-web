-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "activePlayerId" TEXT,
ADD COLUMN     "currentCardIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "hostPlayerId" TEXT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "deckOrder" INTEGER;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "leftAt" TIMESTAMP(3);

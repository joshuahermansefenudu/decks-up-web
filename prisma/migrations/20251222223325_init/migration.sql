-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('LOBBY', 'IN_GAME', 'ENDED');

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "status" "LobbyStatus" NOT NULL DEFAULT 'LOBBY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_code_key" ON "Lobby"("code");

-- CreateIndex
CREATE INDEX "Player_lobbyId_idx" ON "Player"("lobbyId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

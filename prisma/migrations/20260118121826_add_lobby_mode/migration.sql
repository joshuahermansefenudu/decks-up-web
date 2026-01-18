-- CreateEnum
CREATE TYPE "LobbyMode" AS ENUM ('IN_PERSON', 'VIRTUAL');

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "mode" "LobbyMode" NOT NULL DEFAULT 'IN_PERSON';

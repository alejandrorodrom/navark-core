/*
  Warnings:

  - Added the required column `maxPlayers` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mode` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "maxPlayers" INTEGER NOT NULL,
ADD COLUMN     "mode" TEXT NOT NULL,
ADD COLUMN     "teamCount" INTEGER;

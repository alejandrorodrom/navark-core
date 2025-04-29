/*
  Warnings:

  - The `status` column on the `Game` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('waiting', 'in_progress', 'finished');

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "status",
ADD COLUMN     "status" "GameStatus" NOT NULL DEFAULT 'waiting';

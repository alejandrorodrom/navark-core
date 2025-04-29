/*
  Warnings:

  - You are about to drop the column `board` on the `GamePlayer` table. All the data in the column will be lost.
  - Added the required column `board` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "board" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "GamePlayer" DROP COLUMN "board";

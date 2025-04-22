/*
  Warnings:

  - You are about to drop the column `joinCode` on the `Game` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Game` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Game_joinCode_key";

-- DropIndex
DROP INDEX "User_nickname_key";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "joinCode",
ADD COLUMN     "accessCode" TEXT,
ADD COLUMN     "createdById" INTEGER,
ADD COLUMN     "isMatchmaking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Game_name_key" ON "Game"("name");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

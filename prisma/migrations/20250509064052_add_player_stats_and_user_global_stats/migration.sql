-- CreateTable
CREATE TABLE "GamePlayerStats" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "totalShots" INTEGER NOT NULL DEFAULT 0,
    "successfulShots" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipsSunk" INTEGER NOT NULL DEFAULT 0,
    "wasWinner" BOOLEAN NOT NULL DEFAULT false,
    "turnsTaken" INTEGER NOT NULL DEFAULT 0,
    "shipsRemaining" INTEGER NOT NULL DEFAULT 0,
    "wasEliminated" BOOLEAN NOT NULL DEFAULT false,
    "hitStreak" INTEGER NOT NULL DEFAULT 0,
    "lastShotWasHit" BOOLEAN NOT NULL DEFAULT false,
    "shotsByType" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePlayerStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGlobalStats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "totalShots" INTEGER NOT NULL DEFAULT 0,
    "successfulShots" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipsSunk" INTEGER NOT NULL DEFAULT 0,
    "totalTurnsTaken" INTEGER NOT NULL DEFAULT 0,
    "maxHitStreak" INTEGER NOT NULL DEFAULT 0,
    "nuclearUsed" INTEGER NOT NULL DEFAULT 0,
    "lastGameAt" TIMESTAMP(3),

    CONSTRAINT "UserGlobalStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayerStats_gameId_userId_key" ON "GamePlayerStats"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGlobalStats_userId_key" ON "UserGlobalStats"("userId");

-- AddForeignKey
ALTER TABLE "GamePlayerStats" ADD CONSTRAINT "GamePlayerStats_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayerStats" ADD CONSTRAINT "GamePlayerStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGlobalStats" ADD CONSTRAINT "UserGlobalStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

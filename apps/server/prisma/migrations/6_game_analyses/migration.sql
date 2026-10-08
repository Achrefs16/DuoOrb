-- CreateTable
CREATE TABLE "game_analyses" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "analysisVersion" TEXT NOT NULL,
    "totalMoves" INTEGER NOT NULL,
    "winnerId" TEXT,
    "reviewData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_analyses_gameId_key" ON "game_analyses"("gameId");

-- CreateIndex
CREATE INDEX "game_analyses_gameId_idx" ON "game_analyses"("gameId");

-- CreateTable
CREATE TABLE "ai_wins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientWinId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "aiDifficulty" TEXT NOT NULL,
    "playerSeat" INTEGER NOT NULL,
    "movesNotation" TEXT NOT NULL,
    "totalPlies" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_wins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipped_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "equipped_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_wins_userId_clientWinId_key" ON "ai_wins"("userId", "clientWinId");

-- CreateIndex
CREATE INDEX "ai_wins_userId_createdAt_idx" ON "ai_wins"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_userId_code_key" ON "achievements"("userId", "code");

-- CreateIndex
CREATE INDEX "achievements_code_idx" ON "achievements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "equipped_badges_userId_slot_key" ON "equipped_badges"("userId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "equipped_badges_userId_code_key" ON "equipped_badges"("userId", "code");

-- AddForeignKey
ALTER TABLE "ai_wins" ADD CONSTRAINT "ai_wins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipped_badges" ADD CONSTRAINT "equipped_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

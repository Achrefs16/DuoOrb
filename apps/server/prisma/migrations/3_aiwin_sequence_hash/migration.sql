-- AlterTable
ALTER TABLE "ai_wins" ADD COLUMN "sequenceHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ai_wins_userId_sequenceHash_key" ON "ai_wins"("userId", "sequenceHash");

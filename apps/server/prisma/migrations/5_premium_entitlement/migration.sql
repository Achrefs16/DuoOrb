-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profiles" ADD COLUMN "premiumExpiresAt" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN "premiumSource" TEXT;
ALTER TABLE "profiles" ADD COLUMN "premiumUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rcEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "productId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_events_rcEventId_key" ON "subscription_events"("rcEventId");

-- CreateIndex
CREATE INDEX "subscription_events_userId_createdAt_idx" ON "subscription_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

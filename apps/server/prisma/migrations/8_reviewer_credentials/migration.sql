-- CreateTable
CREATE TABLE "reviewer_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewer_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviewer_credentials_userId_key" ON "reviewer_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reviewer_credentials_email_key" ON "reviewer_credentials"("email");

-- AddForeignKey
ALTER TABLE "reviewer_credentials" ADD CONSTRAINT "reviewer_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


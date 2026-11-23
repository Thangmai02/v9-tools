-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "facebookKeyId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookKey" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0f6e56',
    "tokenEnc" TEXT NOT NULL,
    "fbUserId" TEXT,
    "name" TEXT,
    "hostUserId" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacebookKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "LicenseKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fbUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userAccessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacebookAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "facebookAccountId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "pictureUrl" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "imagePath" TEXT,
    "videoPath" TEXT,
    "coverPath" TEXT,
    "commentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "commentText" TEXT,
    "commentImagePath" TEXT,
    "separateComments" BOOLEAN NOT NULL DEFAULT false,
    "delaySeconds" INTEGER NOT NULL DEFAULT 45,
    "commentDelaySeconds" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostJob" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fbPageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fbPostId" TEXT,
    "error" TEXT,
    "commentStatus" TEXT NOT NULL DEFAULT 'skipped',
    "commentError" TEXT,
    "commentId" TEXT,
    "commentMessage" TEXT,
    "commentImagePath" TEXT,
    "commentItems" TEXT,
    "commentSent" INTEGER NOT NULL DEFAULT 0,
    "commentNextAt" TIMESTAMP(3),
    "coverWarning" TEXT,
    "runAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PostJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "adSetId" TEXT,
    "adId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "namePrefix" TEXT NOT NULL DEFAULT 'V9 Camp',
    "objective" TEXT NOT NULL DEFAULT 'engagement',
    "budgetType" TEXT NOT NULL DEFAULT 'daily',
    "budgetAmount" DOUBLE PRECISION NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 7,
    "countries" TEXT NOT NULL DEFAULT 'VN',
    "ageMin" INTEGER NOT NULL DEFAULT 18,
    "ageMax" INTEGER NOT NULL DEFAULT 65,
    "gender" TEXT NOT NULL DEFAULT 'all',
    "cta" TEXT NOT NULL DEFAULT 'LEARN_MORE',
    "adStatus" TEXT NOT NULL DEFAULT 'PAUSED',
    "pageIdFb" TEXT,
    "bidStrategy" TEXT NOT NULL DEFAULT 'LOWEST_COST_WITHOUT_CAP',
    "bidAmount" DOUBLE PRECISION,
    "targetingJson" TEXT,
    "sourceMeta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookKey_hostUserId_key" ON "FacebookKey"("hostUserId");

-- CreateIndex
CREATE INDEX "LicenseKey_userId_status_idx" ON "LicenseKey"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookAccount_userId_key" ON "FacebookAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_facebookAccountId_pageId_key" ON "Page"("facebookAccountId", "pageId");

-- CreateIndex
CREATE INDEX "PostJob_status_runAt_idx" ON "PostJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "PostJob_batchId_position_idx" ON "PostJob"("batchId", "position");

-- CreateIndex
CREATE INDEX "CampJob_userId_createdAt_idx" ON "CampJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CampTemplate_userId_updatedAt_idx" ON "CampTemplate"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facebookKeyId_fkey" FOREIGN KEY ("facebookKeyId") REFERENCES "FacebookKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseKey" ADD CONSTRAINT "LicenseKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookAccount" ADD CONSTRAINT "FacebookAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_facebookAccountId_fkey" FOREIGN KEY ("facebookAccountId") REFERENCES "FacebookAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostBatch" ADD CONSTRAINT "PostBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostJob" ADD CONSTRAINT "PostJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PostBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampJob" ADD CONSTRAINT "CampJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampTemplate" ADD CONSTRAINT "CampTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

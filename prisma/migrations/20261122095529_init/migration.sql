-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LicenseKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "LicenseKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FacebookAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fbUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userAccessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacebookAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facebookAccountId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "pictureUrl" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Page_facebookAccountId_fkey" FOREIGN KEY ("facebookAccountId") REFERENCES "FacebookAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "imagePath" TEXT,
    "delaySeconds" INTEGER NOT NULL DEFAULT 45,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "fbPageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fbPostId" TEXT,
    "error" TEXT,
    "runAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "PostJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PostBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

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

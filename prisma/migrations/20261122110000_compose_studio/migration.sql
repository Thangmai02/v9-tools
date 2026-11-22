-- AlterTable
ALTER TABLE "PostBatch" ADD COLUMN "videoPath" TEXT;
ALTER TABLE "PostBatch" ADD COLUMN "coverPath" TEXT;
ALTER TABLE "PostBatch" ADD COLUMN "commentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PostBatch" ADD COLUMN "commentText" TEXT;
ALTER TABLE "PostBatch" ADD COLUMN "scheduledAt" DATETIME;

-- AlterTable
ALTER TABLE "PostJob" ADD COLUMN "commentStatus" TEXT NOT NULL DEFAULT 'skipped';
ALTER TABLE "PostJob" ADD COLUMN "commentError" TEXT;
ALTER TABLE "PostJob" ADD COLUMN "commentId" TEXT;
ALTER TABLE "PostJob" ADD COLUMN "coverWarning" TEXT;

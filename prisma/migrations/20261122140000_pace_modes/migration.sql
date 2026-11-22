-- AlterTable
ALTER TABLE "PostBatch" ADD COLUMN "commentDelaySeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PostJob" ADD COLUMN "commentNextAt" DATETIME;

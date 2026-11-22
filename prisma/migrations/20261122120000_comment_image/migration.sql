-- AlterTable
ALTER TABLE "PostBatch" ADD COLUMN "commentImagePath" TEXT;
ALTER TABLE "PostBatch" ADD COLUMN "separateComments" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PostJob" ADD COLUMN "commentMessage" TEXT;
ALTER TABLE "PostJob" ADD COLUMN "commentImagePath" TEXT;

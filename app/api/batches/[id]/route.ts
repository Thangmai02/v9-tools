import { NextResponse } from "next/server";
import { parseStoredComments } from "@/lib/comment-items";
import { parseJobLog } from "@/lib/job-log";
import { prisma } from "@/lib/db";
import { requireProUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireProUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const user = gate.user;
  const { id } = await context.params;
  const batch = await prisma.postBatch.findFirst({
    where: { id, userId: user.id },
    include: { jobs: { orderBy: { position: "asc" } } },
  });
  if (!batch) {
    return NextResponse.json({ error: "Không thấy đợt đăng." }, { status: 404 });
  }
  return NextResponse.json({
    batch: {
      id: batch.id,
      message: batch.message,
      link: batch.link,
      delaySeconds: batch.delaySeconds,
      commentDelaySeconds: batch.commentDelaySeconds,
      status: batch.status,
      stopAfterJobId: batch.stopAfterJobId,
      createdAt: batch.createdAt,
      completedAt: batch.completedAt,
      pace: batch.pace,
      concurrency: batch.concurrency,
      scheduledAt: batch.scheduledAt,
      commentEnabled: batch.commentEnabled,
      commentText: batch.commentText,
      separateComments: batch.separateComments,
      hasCommentImage: Boolean(batch.commentImagePath),
      hasImage: Boolean(batch.imagePath),
      hasVideo: Boolean(batch.videoPath),
      hasCover: Boolean(batch.coverPath),
      jobs: batch.jobs.map((job) => ({
        id: job.id,
        pageName: job.pageName,
        status: job.status,
        fbPostId: job.fbPostId,
        error: job.error,
        commentStatus: job.commentStatus,
        commentError: job.commentError,
        reactionStatus: job.reactionStatus,
        commentMessage: job.commentMessage,
        hasCommentImage: Boolean(job.commentImagePath),
        comments: parseStoredComments(job.commentItems).map((item) => ({
          message: item.message,
          hasImage: Boolean(item.imagePath),
        })),
        coverWarning: job.coverWarning,
        stage: job.stage,
        log: parseJobLog(job.log).slice(-12),
        runAt: job.runAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      })),
    },
  });
}

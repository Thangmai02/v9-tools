import { commentHasContent, parseStoredComments, type StoredComment } from "@/lib/comment-items";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GraphError } from "@/lib/graph";
import {
  captionForPhoto,
  commentAsPage,
  publishFeed,
  publishPhoto,
  publishVideo,
} from "@/lib/publish";

const STUCK_MS = 15 * 60 * 1000;

async function refreshBatch(batchId: string) {
  const jobs = await prisma.postJob.findMany({ where: { batchId } });
  if (jobs.length === 0) return;
  const open = jobs.some(
    (job) =>
      job.status === "pending" ||
      job.status === "running" ||
      job.status === "draft" ||
      (job.status === "success" && job.commentStatus === "pending"),
  );
  if (!open) {
    await prisma.postBatch.update({
      where: { id: batchId },
      data: { status: "finished" },
    });
  }
}

async function scheduleNext(batchId: string, delaySeconds: number) {
  const next = await prisma.postJob.findFirst({
    where: { batchId, status: "pending", runAt: null },
    orderBy: { position: "asc" },
  });
  if (!next) return;
  await prisma.postJob.update({
    where: { id: next.id },
    data: { runAt: new Date(Date.now() + delaySeconds * 1000) },
  });
}

async function pageToken(fbPageId: string) {
  return prisma.page.findFirst({
    where: { pageId: fbPageId },
    orderBy: { updatedAt: "desc" },
  });
}

async function finishPendingComments() {
  const now = new Date();
  const jobs = await prisma.postJob.findMany({
    where: {
      status: "success",
      commentStatus: "pending",
      OR: [{ commentNextAt: null }, { commentNextAt: { lte: now } }],
    },
    include: { batch: true },
    take: 5,
  });
  for (const job of jobs) {
    const items = commentsForJob(job);
    if (!job.batch.commentEnabled || !commentHasContent(items) || !job.fbPostId) {
      await prisma.postJob.update({
        where: { id: job.id },
        data: { commentStatus: "skipped", commentError: null, commentNextAt: null },
      });
      await refreshBatch(job.batchId);
      continue;
    }
    try {
      const page = await pageToken(job.fbPageId);
      if (!page) throw new Error("Page không còn. Admin cần đổi hoặc tải lại mã khóa.");
      let sent = job.commentSent;
      let commentId = job.commentId;
      let waiting = false;
      const gap = job.batch.commentDelaySeconds;
      while (sent < items.length) {
        const item = items[sent];
        if (!item.message && !item.imagePath) {
          sent += 1;
          continue;
        }
        commentId = await commentAsPage({
          pageId: page.pageId,
          postId: job.fbPostId,
          token: decrypt(page.accessTokenEnc),
          message: item.message ?? "",
          imagePath: item.imagePath,
        });
        sent += 1;
        const more = items.slice(sent).some((entry) => entry.message || entry.imagePath);
        if (gap > 0 && more) {
          await prisma.postJob.update({
            where: { id: job.id },
            data: {
              commentSent: sent,
              commentId,
              commentError: null,
              commentNextAt: new Date(Date.now() + gap * 1000),
            },
          });
          waiting = true;
          break;
        }
        await prisma.postJob.update({
          where: { id: job.id },
          data: { commentSent: sent, commentId, commentError: null, commentNextAt: null },
        });
      }
      if (!waiting) {
        await prisma.postJob.update({
          where: { id: job.id },
          data: { commentStatus: "success", commentSent: sent, commentId, commentError: null, commentNextAt: null },
        });
        console.log(`Đã bình luận ${job.pageName}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không bình luận được.";
      const attempts = retryCount(job.commentError) + 1;
      if (transientCommentError(error) && attempts <= 8) {
        const waitSeconds = Math.min(60, 8 * attempts);
        await prisma.postJob.update({
          where: { id: job.id },
          data: {
            commentStatus: "pending",
            commentError: `retry:${attempts}`,
            commentNextAt: new Date(Date.now() + waitSeconds * 1000),
          },
        });
        console.log(`Reel ${job.pageName} chưa nhận bình luận, thử lại sau ${waitSeconds} giây.`);
        await refreshBatch(job.batchId);
        continue;
      }
      await prisma.postJob.update({
        where: { id: job.id },
        data: { commentStatus: "failed", commentError: message, commentNextAt: null },
      });
      console.log(`Bài đã đăng, bình luận lỗi ${job.pageName}: ${message}`);
    }
    await refreshBatch(job.batchId);
  }
}

function retryCount(error: string | null) {
  const match = /^retry:(\d+)$/.exec(error ?? "");
  return match ? Number(match[1]) : 0;
}

function transientCommentError(error: unknown) {
  if (!(error instanceof GraphError)) return false;
  if (error.code === 1 || error.code === 2) return true;
  if (error.code === 100 && error.subcode === 33) return true;
  return false;
}

function commentsForJob(job: {
  commentItems: string | null;
  commentMessage: string | null;
  commentImagePath: string | null;
  batch: { commentText: string | null };
}): StoredComment[] {
  const stored = parseStoredComments(job.commentItems);
  if (stored.length) return stored;
  const message = (job.commentMessage ?? job.batch.commentText ?? "").trim();
  if (message || job.commentImagePath) {
    return [{ message: message || null, imagePath: job.commentImagePath }];
  }
  return [];
}

async function recoverStuck() {
  const cutoff = new Date(Date.now() - STUCK_MS);
  const stuck = await prisma.postJob.findMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    include: { batch: true },
  });
  for (const job of stuck) {
    await prisma.postJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: "Worker bị gián đoạn trước khi đăng xong.",
        finishedAt: new Date(),
      },
    });
    await scheduleNext(job.batchId, job.batch.delaySeconds);
    await refreshBatch(job.batchId);
  }
}

async function tick() {
  await recoverStuck();
  await finishPendingComments();
  const job = await prisma.postJob.findFirst({
    where: { status: "pending", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    include: { batch: true },
  });
  if (!job) return false;

  const claim = await prisma.postJob.updateMany({
    where: { id: job.id, status: "pending" },
    data: { status: "running", startedAt: new Date() },
  });
  if (claim.count !== 1) return true;

  await prisma.postBatch.update({
    where: { id: job.batchId },
    data: { status: "running" },
  });

  try {
    const page = await pageToken(job.fbPageId);
    if (!page) {
      throw new Error("Page không còn. Admin cần đổi hoặc tải lại mã khóa.");
    }
    const token = decrypt(page.accessTokenEnc);
    const caption = captionForPhoto(job.batch.message, job.batch.link);
    let fbPostId: string;
    let coverWarning: string | null = null;
    if (job.batch.videoPath) {
      const published = await publishVideo({
        pageId: page.pageId,
        token,
        description: caption,
        filePath: job.batch.videoPath,
        coverPath: job.batch.coverPath,
      });
      fbPostId = published.postId;
      coverWarning = published.coverWarning;
    } else if (job.batch.imagePath) {
      fbPostId = await publishPhoto({
        pageId: page.pageId,
        token,
        caption,
        filePath: job.batch.imagePath,
      });
    } else {
      fbPostId = await publishFeed({
        pageId: page.pageId,
        token,
        message: job.batch.message,
        link: job.batch.link,
      });
    }

    const wantComment = job.batch.commentEnabled && commentHasContent(commentsForJob(job));
    await prisma.postJob.update({
      where: { id: job.id },
      data: {
        status: "success",
        fbPostId,
        error: null,
        coverWarning,
        commentStatus: wantComment ? "pending" : "skipped",
        finishedAt: new Date(),
      },
    });
    console.log(`Đã đăng ${job.pageName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đăng bài thất bại.";
    await prisma.postJob.update({
      where: { id: job.id },
      data: { status: "failed", error: message, finishedAt: new Date() },
    });
    console.log(`Lỗi ${job.pageName}: ${message}`);
  }

  await scheduleNext(job.batchId, job.batch.delaySeconds);
  await refreshBatch(job.batchId);
  return true;
}

async function main() {
  console.log("Worker đăng bài đang chạy.");
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopped) {
    try {
      const worked = await tick();
      if (!worked) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lỗi worker.";
      console.error(message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Worker dừng vì lỗi.";
  console.error(message);
  process.exit(1);
});

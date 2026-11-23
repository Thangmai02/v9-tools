import { stat } from "fs/promises";
import { thisFileHost, uploadExists } from "@/lib/upload-path";
import type { Prisma } from "@prisma/client";
import { appendJobLog } from "@/lib/job-log";
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
  resolveCommentPostId,
  uploadAbsolute,
} from "@/lib/publish";

const STUCK_MS = 15 * 60 * 1000;
const POST_WAIT = ["pending", "queued"];
const COMMENT_WAIT = ["pending", "waiting"];

async function note(
  jobId: string,
  stage: string,
  message = stage,
  extra: Prisma.PostJobUpdateInput = {},
) {
  try {
    const current = await prisma.postJob.findUnique({
      where: { id: jobId },
      select: { log: true },
    });
    await prisma.postJob.update({
      where: { id: jobId },
      data: { ...extra, stage, log: appendJobLog(current?.log, message) },
    });
    console.log(`${stage}: ${message}`);
  } catch (error) {
    const text = error instanceof Error ? error.message : "Không ghi được nhật ký.";
    console.log(text);
  }
}

async function refreshBatch(batchId: string) {
  const [jobs, batch] = await Promise.all([
    prisma.postJob.findMany({ where: { batchId } }),
    prisma.postBatch.findUnique({
      where: { id: batchId },
      select: { status: true, stopAfterJobId: true },
    }),
  ]);
  if (jobs.length === 0 || !batch) return;
  const open = jobs.some(
    (job) =>
      POST_WAIT.includes(job.status) ||
      job.status === "running" ||
      job.status === "draft" ||
      (job.status === "success" && COMMENT_WAIT.includes(job.commentStatus)),
  );
  if (open) return;
  const stopped = batch.status === "stopping" || Boolean(batch.stopAfterJobId);
  await prisma.postBatch.update({
    where: { id: batchId },
    data: { status: stopped ? "stopped" : "finished" },
  });
}

async function cancelPending(batchId: string, exceptId?: string | null) {
  const jobs = await prisma.postJob.findMany({
    where: {
      batchId,
      status: { in: POST_WAIT },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  const now = new Date();
  for (const job of jobs) {
    await prisma.postJob.update({
      where: { id: job.id },
      data: {
        status: "cancelled",
        stage: "Đã dừng",
        log: appendJobLog(job.log, "Dừng theo yêu cầu. Page này không đăng."),
        commentStatus: "skipped",
        commentNextAt: null,
        error: null,
        finishedAt: now,
      },
    });
  }
}

async function scheduleNext(batchId: string, delaySeconds: number, finishedJobId: string) {
  const batch = await prisma.postBatch.findUnique({
    where: { id: batchId },
    select: { status: true, stopAfterJobId: true },
  });
  if (!batch) return;
  if (
    batch.status === "stopped" ||
    batch.status === "stopping" ||
    batch.stopAfterJobId === finishedJobId
  ) {
    await cancelPending(batchId, batch.stopAfterJobId);
    await refreshBatch(batchId);
    return;
  }
  const next = await prisma.postJob.findFirst({
    where: { batchId, status: { in: POST_WAIT }, runAt: null },
    orderBy: { position: "asc" },
  });
  if (!next) return;
  const runAt = new Date(Date.now() + delaySeconds * 1000);
  const stage = delaySeconds === 0 ? "Đến lượt, đăng ngay" : `Chờ ${delaySeconds} giây rồi đăng`;
  const message =
    delaySeconds === 0
      ? "Page trước đã xong. Đăng Page này ngay."
      : `Page trước đã xong. Chờ ${delaySeconds} giây rồi đăng Page này.`;
  await prisma.postJob.update({
    where: { id: next.id },
    data: { runAt, stage, log: appendJobLog(next.log, message) },
  });
}

async function pageToken(fbPageId: string) {
  return prisma.page.findFirst({
    where: { pageId: fbPageId },
    orderBy: { updatedAt: "desc" },
  });
}

function filesAreHere(paths: (string | null | undefined)[]) {
  const needed = paths.filter((item): item is string => Boolean(item));
  if (needed.length === 0) return true;
  return needed.every((item) => uploadExists(item));
}

async function finishPendingComments() {
  const now = new Date();
  const host = thisFileHost();
  const readyBatch = {
    jobs: { none: { status: { in: ["pending", "queued", "running"] } } },
  };
  const due = {
    status: "success" as const,
    commentStatus: { in: COMMENT_WAIT },
    OR: [{ commentNextAt: null }, { commentNextAt: { lte: now } }],
  };
  let jobs = await prisma.postJob.findMany({
    where: { ...due, batch: { ...readyBatch, fileHost: host } },
    include: { batch: true },
    orderBy: { finishedAt: "asc" },
    take: 20,
  });
  if (jobs.length === 0) {
    const legacy = await prisma.postJob.findMany({
      where: { ...due, batch: { ...readyBatch, fileHost: null } },
      include: { batch: true },
      orderBy: { finishedAt: "asc" },
      take: 40,
    });
    jobs = legacy
      .filter((job) => filesAreHere(commentsForJob(job).map((item) => item.imagePath)))
      .slice(0, 20);
  }
  if (jobs.length === 0) return false;
  for (const job of jobs) {
    const claim = await prisma.postJob.updateMany({
      where: {
        id: job.id,
        commentStatus: { in: COMMENT_WAIT },
        OR: [{ commentNextAt: null }, { commentNextAt: { lte: now } }],
      },
      data: { commentNextAt: new Date(Date.now() + 2 * 60 * 1000) },
    });
    if (claim.count !== 1) continue;
    const items = commentsForJob(job);
    if (!job.batch.commentEnabled || !commentHasContent(items) || !job.fbPostId) {
      await prisma.postJob.update({
        where: { id: job.id },
        data: { commentStatus: "skipped", commentError: null, commentNextAt: null },
      });
      await note(job.id, "Đã đăng", "Không gửi bình luận.");
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
        const token = decrypt(page.accessTokenEnc);
        const resolved = await resolveCommentPostId(page.pageId, job.fbPostId, token);
        if (!resolved) {
          throw new GraphError("Video chưa sẵn sàng để bình luận.", { code: 100, subcode: 33 });
        }
        if (resolved !== job.fbPostId) {
          job.fbPostId = resolved;
          await prisma.postJob.update({
            where: { id: job.id },
            data: { fbPostId: resolved },
          });
        }
        await note(
          job.id,
          `Bình luận ${sent + 1}/${items.length}`,
          `Đang gửi bình luận ${sent + 1}/${items.length} cho ${job.pageName}.`,
        );
        commentId = await commentAsPage({
          pageId: page.pageId,
          postId: job.fbPostId,
          token,
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
          await note(
            job.id,
            `Chờ ${gap} giây`,
            `Đã gửi bình luận ${sent}/${items.length}. Chờ ${gap} giây rồi gửi tiếp.`,
          );
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
        await note(job.id, "Đã bình luận", `Đã bình luận xong ${job.pageName}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không bình luận được.";
      const attempts = retryCount(job.commentError) + 1;
      if (transientCommentError(error) && attempts <= 8) {
        const waitSeconds = Math.min(60, 8 * attempts);
        await prisma.postJob.update({
          where: { id: job.id },
          data: {
            commentStatus: "waiting",
            commentError: `retry:${attempts}`,
            commentNextAt: new Date(Date.now() + waitSeconds * 1000),
          },
        });
        await note(
          job.id,
          `Chờ ${waitSeconds} giây`,
          `Facebook chưa nhận bình luận, thử lại sau ${waitSeconds} giây (lần ${attempts}).`,
        );
        await refreshBatch(job.batchId);
        continue;
      }
      await prisma.postJob.update({
        where: { id: job.id },
        data: { commentStatus: "failed", commentError: message, commentNextAt: null },
      });
      await note(job.id, "Bình luận lỗi", message.slice(0, 280));
    }
    await refreshBatch(job.batchId);
  }
  return true;
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
    await note(job.id, "Lỗi đăng", "Bị gián đoạn trước khi đăng xong.", {
      status: "failed",
      error: "Bị gián đoạn trước khi đăng xong.",
      finishedAt: new Date(),
    });
    await scheduleNext(job.batchId, job.batch.delaySeconds, job.id);
    await refreshBatch(job.batchId);
  }
}

async function fileSizeNote(filePath: string) {
  try {
    const info = await stat(uploadAbsolute(filePath));
    const mb = info.size / (1024 * 1024);
    return mb >= 0.1 ? ` ${mb.toFixed(1)} MB` : "";
  } catch {
    return "";
  }
}

async function publishDue() {
  const now = new Date();
  const host = thisFileHost();
  let job = await prisma.postJob.findFirst({
    where: {
      status: { in: POST_WAIT },
      runAt: { lte: now },
      batch: { fileHost: host },
    },
    orderBy: { runAt: "asc" },
    include: { batch: true },
  });
  if (!job) {
    const legacy = await prisma.postJob.findMany({
      where: {
        status: { in: POST_WAIT },
        runAt: { lte: now },
        batch: { fileHost: null },
      },
      orderBy: { runAt: "asc" },
      include: { batch: true },
      take: 40,
    });
    job =
      legacy.find((item) =>
        filesAreHere([item.batch.videoPath, item.batch.imagePath, item.batch.coverPath]),
      ) ?? null;
  }
  if (!job) return false;

  if (
    job.batch.status === "stopped" ||
    (job.batch.stopAfterJobId != null && job.batch.stopAfterJobId !== job.id)
  ) {
    await prisma.postJob.update({
      where: { id: job.id },
      data: {
        status: "cancelled",
        stage: "Đã dừng",
        log: appendJobLog(job.log, "Dừng theo yêu cầu. Page này không đăng."),
        commentStatus: "skipped",
        commentNextAt: null,
        finishedAt: new Date(),
      },
    });
    await refreshBatch(job.batchId);
    return true;
  }

  const claim = await prisma.postJob.updateMany({
    where: { id: job.id, status: { in: POST_WAIT } },
    data: { status: "running", startedAt: new Date(), stage: "Đang chuẩn bị" },
  });
  if (claim.count !== 1) return true;

  if (job.batch.status !== "stopping") {
    await prisma.postBatch.update({
      where: { id: job.batchId },
      data: { status: "running" },
    });
  }

  try {
    await note(job.id, "Đang chuẩn bị", `Bắt đầu đăng ${job.pageName}.`);
    const page = await pageToken(job.fbPageId);
    if (!page) {
      throw new Error("Page không còn. Admin cần đổi hoặc tải lại mã khóa.");
    }
    const token = decrypt(page.accessTokenEnc);
    const caption = captionForPhoto(job.batch.message, job.batch.link);
    let fbPostId: string;
    let coverWarning: string | null = null;
    if (job.batch.videoPath) {
      const size = await fileSizeNote(job.batch.videoPath);
      await note(job.id, "Đang tải video", `Đang tải video${size} lên Facebook.`);
      const published = await publishVideo({
        pageId: page.pageId,
        token,
        description: caption,
        filePath: job.batch.videoPath,
        coverPath: job.batch.coverPath,
        onStage: (text) => note(job.id, text, text),
      });
      fbPostId = published.postId;
      coverWarning = published.coverWarning;
    } else if (job.batch.imagePath) {
      const size = await fileSizeNote(job.batch.imagePath);
      await note(job.id, "Đang tải ảnh", `Đang tải ảnh${size} lên Facebook.`);
      fbPostId = await publishPhoto({
        pageId: page.pageId,
        token,
        caption,
        filePath: job.batch.imagePath,
      });
    } else {
      await note(job.id, "Đang đăng bài", "Đang gửi nội dung lên Facebook.");
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
        commentStatus: wantComment ? "waiting" : "skipped",
        finishedAt: new Date(),
      },
    });
    await note(
      job.id,
      wantComment ? "Đã đăng, chờ cả đợt" : "Đã đăng",
      wantComment
        ? "Facebook đã nhận bài. Bình luận chạy sau khi mọi Page trong đợt đã đăng xong."
        : "Facebook đã nhận bài.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đăng bài thất bại.";
    await prisma.postJob.update({
      where: { id: job.id },
      data: { status: "failed", error: message, finishedAt: new Date() },
    });
    await note(job.id, "Lỗi đăng", message.slice(0, 280));
  }

  await scheduleNext(job.batchId, job.batch.delaySeconds, job.id);
  await refreshBatch(job.batchId);
  return true;
}

async function tick() {
  await recoverStuck();
  if (await publishDue()) return true;
  return finishPendingComments();
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
        await new Promise((resolve) => setTimeout(resolve, 800));
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

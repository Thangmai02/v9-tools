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
  reactAsPage,
  resolveCommentPostId,
  uploadAbsolute,
} from "@/lib/publish";

const STUCK_MS = 15 * 60 * 1000;
const POST_WAIT = ["pending", "queued"];
const COMMENT_WAIT = ["pending", "waiting"];
const REACTION_WAIT = ["pending", "waiting"];

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
      select: { status: true, stopAfterJobId: true, completedAt: true },
    }),
  ]);
  if (jobs.length === 0 || !batch) return;
  const open = jobs.some(
    (job) =>
      POST_WAIT.includes(job.status) ||
      job.status === "running" ||
      job.status === "draft" ||
      (job.status === "success" &&
        (COMMENT_WAIT.includes(job.commentStatus) ||
          job.commentStatus === "running" ||
          REACTION_WAIT.includes(job.reactionStatus) ||
          job.reactionStatus === "running")),
  );
  if (open) return;
  const stopped = batch.status === "stopping" || Boolean(batch.stopAfterJobId);
  await prisma.postBatch.update({
    where: { id: batchId },
    data: {
      status: stopped ? "stopped" : "finished",
      completedAt: batch.completedAt ?? new Date(),
    },
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

type RunningJob = Prisma.PostJobGetPayload<{ include: { batch: true } }>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadPost(job: RunningJob) {
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
    await note(
      job.id,
      "Đang tải video",
      `Đang tải video${size} lên Facebook. Bước này chờ Facebook nhận hết file, file nặng sẽ lâu.`,
    );
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
    await note(
      job.id,
      "Đang tải ảnh",
      `Đang tải ảnh${size} lên Facebook. Bước này chờ Facebook nhận hết file.`,
    );
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
  return { fbPostId, coverWarning, pageId: page.pageId, token };
}

async function deliverComments(job: RunningJob, pageId: string, token: string) {
  const items = commentsForJob(job);
  let sent = job.commentSent;
  let commentId = job.commentId;
  const gap = job.batch.commentDelaySeconds;
  let attempts = 0;
  try {
    while (sent < items.length) {
      const item = items[sent];
      if (!item.message && !item.imagePath) {
        sent += 1;
        continue;
      }
      let resolved: string | null = null;
      while (!resolved && attempts < 6) {
        resolved = await resolveCommentPostId(pageId, job.fbPostId ?? "", token);
        if (resolved) break;
        attempts += 1;
        const waitSeconds = Math.min(20, 5 * attempts);
        await note(
          job.id,
          `Chờ ${waitSeconds} giây`,
          `Video chưa sẵn sàng để bình luận, thử lại sau ${waitSeconds} giây.`,
        );
        await sleep(waitSeconds * 1000);
      }
      if (!resolved) {
        await prisma.postJob.update({
          where: { id: job.id },
          data: {
            commentStatus: "waiting",
            commentSent: sent,
            commentError: "retry:1",
            commentNextAt: new Date(Date.now() + 20_000),
          },
        });
        await note(job.id, "Chờ bình luận", "Facebook chưa cho bình luận. Sẽ thử lại, luồng nhận bài khác.");
        return;
      }
      if (resolved !== job.fbPostId) {
        job.fbPostId = resolved;
        await prisma.postJob.update({ where: { id: job.id }, data: { fbPostId: resolved } });
      }
      await note(
        job.id,
        `Bình luận ${sent + 1}/${items.length}`,
        `Đang gửi bình luận ${sent + 1}/${items.length} cho ${job.pageName}.`,
      );
      try {
        commentId = await commentAsPage({
          pageId,
          postId: resolved,
          token,
          message: item.message ?? "",
          imagePath: item.imagePath,
        });
      } catch (error) {
        if (transientCommentError(error) && attempts < 6) {
          attempts += 1;
          const waitSeconds = Math.min(20, 5 * attempts);
          await note(
            job.id,
            `Chờ ${waitSeconds} giây`,
            `Facebook chưa nhận bình luận, thử lại sau ${waitSeconds} giây.`,
          );
          await sleep(waitSeconds * 1000);
          continue;
        }
        throw error;
      }
      sent += 1;
      attempts = 0;
      await prisma.postJob.update({
        where: { id: job.id },
        data: { commentSent: sent, commentId, commentError: null },
      });
      const more = items.slice(sent).some((entry) => entry.message || entry.imagePath);
      if (gap > 0 && more) await sleep(gap * 1000);
    }
    await prisma.postJob.update({
      where: { id: job.id },
      data: {
        commentStatus: "success",
        commentSent: sent,
        commentId,
        commentError: null,
        commentNextAt: null,
      },
    });
    await note(job.id, "Đã bình luận", `Đã bình luận xong ${job.pageName}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không bình luận được.";
    await prisma.postJob.update({
      where: { id: job.id },
      data: { commentStatus: "failed", commentError: message, commentNextAt: null },
    });
    await note(job.id, "Bình luận lỗi", message.slice(0, 280));
  }
}

async function deliverLike(job: RunningJob, pageId: string, token: string) {
  try {
    if (!job.fbPostId) throw new Error("Bài chưa có id để thả Thích.");
    let resolved: string | null = null;
    let attempts = 0;
    while (!resolved && attempts < 4) {
      resolved = await resolveCommentPostId(pageId, job.fbPostId, token);
      if (resolved) break;
      attempts += 1;
      await sleep(5_000 * attempts);
    }
    if (!resolved) throw new GraphError("Bài chưa sẵn sàng để thả Thích.", { code: 100, subcode: 33 });
    if (resolved !== job.fbPostId) {
      job.fbPostId = resolved;
      await prisma.postJob.update({ where: { id: job.id }, data: { fbPostId: resolved } });
    }
    await note(job.id, "Đang thả Thích", `Đang thả Thích cho ${job.pageName}.`);
    await reactAsPage({ pageId, postId: resolved, token, type: "LIKE" });
    await prisma.postJob.update({
      where: { id: job.id },
      data: { reactionStatus: "success", reactionError: null, reactionNextAt: null },
    });
    await note(job.id, "Đã thả Thích", `Đã thả Thích cho ${job.pageName}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thả được Thích.";
    if (transientCommentError(error)) {
      await prisma.postJob.update({
        where: { id: job.id },
        data: {
          reactionStatus: "waiting",
          reactionError: "retry:1",
          reactionNextAt: new Date(Date.now() + 15_000),
        },
      });
      await note(job.id, "Chờ thả Thích", "Facebook chưa nhận Thích, sẽ thử lại.");
      return;
    }
    await prisma.postJob.update({
      where: { id: job.id },
      data: { reactionStatus: "failed", reactionError: message, reactionNextAt: null },
    });
    await note(job.id, "Thích lỗi", message.slice(0, 280));
  }
}

async function honorStop(batchId: string, finishedJobId: string) {
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
  }
}

async function runFastJob(jobId: string) {
  const job = await prisma.postJob.findUnique({
    where: { id: jobId },
    include: { batch: true },
  });
  if (!job || job.status !== "running") return;
  try {
    const uploaded = await uploadPost(job);
    const wantComment = job.batch.commentEnabled && commentHasContent(commentsForJob(job));
    const wantReaction = job.batch.reactionEnabled;
    await prisma.postJob.update({
      where: { id: job.id },
      data: {
        fbPostId: uploaded.fbPostId,
        error: null,
        coverWarning: uploaded.coverWarning,
        commentStatus: wantComment ? "running" : "skipped",
        reactionStatus: wantReaction ? "running" : "skipped",
        reactionError: null,
        reactionNextAt: null,
      },
    });
    job.fbPostId = uploaded.fbPostId;
    await note(job.id, "Đã nhận bài", "Facebook đã nhận bài. Luồng này gửi bình luận rồi thả Thích.");
    if (wantComment) await deliverComments(job, uploaded.pageId, uploaded.token);
    if (wantReaction) await deliverLike(job, uploaded.pageId, uploaded.token);
    await prisma.postJob.update({
      where: { id: job.id },
      data: { status: "success", finishedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đăng bài thất bại.";
    const current = await prisma.postJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (current?.status === "running") {
      await prisma.postJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: message,
          finishedAt: new Date(),
          commentStatus: "skipped",
          reactionStatus: "skipped",
        },
      });
      await note(jobId, "Lỗi đăng", message.slice(0, 280));
    }
  }
  await honorStop(job.batchId, jobId);
  await refreshBatch(job.batchId);
}

async function startParallelJobs() {
  const now = new Date();
  const host = thisFileHost();
  const candidates = await prisma.postJob.findMany({
    where: {
      status: { in: POST_WAIT },
      runAt: { lte: now },
      batch: { fileHost: host, pace: "fast", status: { notIn: ["stopped", "stopping"] } },
    },
    include: { batch: true },
    orderBy: [{ runAt: "asc" }, { position: "asc" }],
    take: 40,
  });
  if (candidates.length === 0) return false;
  const runningRows = await prisma.postJob.findMany({
    where: { status: "running", batch: { pace: "fast", fileHost: host } },
    select: { batch: { select: { userId: true } } },
  });
  const runningByUser = new Map<string, number>();
  for (const row of runningRows) {
    runningByUser.set(row.batch.userId, (runningByUser.get(row.batch.userId) ?? 0) + 1);
  }
  const capByUser = new Map<string, number>();
  for (const job of candidates) {
    capByUser.set(
      job.batch.userId,
      Math.max(capByUser.get(job.batch.userId) ?? 1, job.batch.concurrency),
    );
  }
  let globalBusy = runningRows.length;
  let started = false;
  for (const job of candidates) {
    if (globalBusy >= 8) break;
    if (job.batch.stopAfterJobId != null && job.batch.stopAfterJobId !== job.id) continue;
    const userRunning = runningByUser.get(job.batch.userId) ?? 0;
    const cap = Math.min(8, Math.max(1, capByUser.get(job.batch.userId) ?? job.batch.concurrency));
    if (userRunning >= cap) continue;
    const claim = await prisma.postJob.updateMany({
      where: { id: job.id, status: { in: POST_WAIT } },
      data: { status: "running", startedAt: new Date(), stage: "Đang chuẩn bị" },
    });
    if (claim.count !== 1) continue;
    if (job.batch.status !== "stopping") {
      await prisma.postBatch.update({
        where: { id: job.batchId },
        data: { status: "running" },
      });
    }
    runningByUser.set(job.batch.userId, userRunning + 1);
    globalBusy += 1;
    started = true;
    void runFastJob(job.id).catch((error) => {
      const message = error instanceof Error ? error.message : "Lỗi luồng đăng.";
      console.error(message);
    });
  }
  return started;
}

async function publishDue() {
  const now = new Date();
  const host = thisFileHost();
  let job = await prisma.postJob.findFirst({
    where: {
      status: { in: POST_WAIT },
      runAt: { lte: now },
      batch: { fileHost: host, pace: "human" },
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
    const uploaded = await uploadPost(job);
    const wantComment = job.batch.commentEnabled && commentHasContent(commentsForJob(job));
    const wantReaction = job.batch.reactionEnabled;
    await prisma.postJob.update({
      where: { id: job.id },
      data: {
        status: "success",
        fbPostId: uploaded.fbPostId,
        error: null,
        coverWarning: uploaded.coverWarning,
        commentStatus: wantComment ? "waiting" : "skipped",
        reactionStatus: wantReaction ? "waiting" : "skipped",
        reactionError: null,
        reactionNextAt: null,
        finishedAt: new Date(),
      },
    });
    const doneBits = ["Facebook đã nhận bài."];
    if (wantComment) doneBits.push("Bình luận chạy sau khi mọi Page trong đợt đã đăng xong.");
    if (wantReaction) doneBits.push("Sẽ thả Thích.");
    await note(
      job.id,
      wantComment ? "Đã đăng, chờ cả đợt" : wantReaction ? "Đã đăng, chờ Thích" : "Đã đăng",
      doneBits.join(" "),
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

async function finishPendingReactions() {
  const now = new Date();
  const jobs = await prisma.postJob.findMany({
    where: {
      status: "success",
      reactionStatus: { in: REACTION_WAIT },
      OR: [{ reactionNextAt: null }, { reactionNextAt: { lte: now } }],
      batch: { reactionEnabled: true },
    },
    include: { batch: true },
    orderBy: { finishedAt: "asc" },
    take: 10,
  });
  if (jobs.length === 0) return false;
  for (const job of jobs) {
    const claim = await prisma.postJob.updateMany({
      where: {
        id: job.id,
        reactionStatus: { in: REACTION_WAIT },
        OR: [{ reactionNextAt: null }, { reactionNextAt: { lte: now } }],
      },
      data: { reactionNextAt: new Date(Date.now() + 2 * 60 * 1000) },
    });
    if (claim.count !== 1) continue;
    try {
      if (!job.fbPostId) throw new Error("Bài chưa có id để thả Thích.");
      const page = await pageToken(job.fbPageId);
      if (!page) throw new Error("Page không còn. Admin cần đổi hoặc tải lại mã khóa.");
      const token = decrypt(page.accessTokenEnc);
      const resolved = await resolveCommentPostId(page.pageId, job.fbPostId, token);
      if (!resolved) {
        throw new GraphError("Bài chưa sẵn sàng để thả cảm xúc.", { code: 100, subcode: 33 });
      }
      if (resolved !== job.fbPostId) {
        await prisma.postJob.update({ where: { id: job.id }, data: { fbPostId: resolved } });
      }
      await note(job.id, "Đang thả Thích", `Đang thả Thích cho ${job.pageName}.`);
      await reactAsPage({
        pageId: page.pageId,
        postId: resolved,
        token,
        type: "LIKE",
      });
      await prisma.postJob.update({
        where: { id: job.id },
        data: { reactionStatus: "success", reactionError: null, reactionNextAt: null },
      });
      await note(
        job.id,
        "Đã thả Thích",
        `Đã thả Thích cho ${job.pageName}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thả được cảm xúc.";
      const attempts = retryCount(job.reactionError) + 1;
      if (transientCommentError(error) && attempts <= 8) {
        const waitSeconds = Math.min(60, 8 * attempts);
        await prisma.postJob.update({
          where: { id: job.id },
          data: {
            reactionStatus: "waiting",
            reactionError: `retry:${attempts}`,
            reactionNextAt: new Date(Date.now() + waitSeconds * 1000),
          },
        });
        await note(
          job.id,
          `Chờ ${waitSeconds} giây`,
          `Facebook chưa nhận cảm xúc, thử lại sau ${waitSeconds} giây (lần ${attempts}).`,
        );
      } else {
        await prisma.postJob.update({
          where: { id: job.id },
          data: { reactionStatus: "failed", reactionError: message, reactionNextAt: null },
        });
        await note(job.id, "Cảm xúc lỗi", message.slice(0, 280));
      }
    }
    await refreshBatch(job.batchId);
  }
  return true;
}

async function tick() {
  await recoverStuck();
  const started = await startParallelJobs();
  if (await publishDue()) return true;
  if (await finishPendingReactions()) return true;
  const commented = await finishPendingComments();
  if (started || commented) return true;
  const busy = await prisma.postJob.count({
    where: { status: "running", batch: { pace: "fast" } },
  });
  if (busy > 0) {
    await sleep(400);
    return true;
  }
  return false;
}

async function main() {
  await prisma.postJob.updateMany({
    where: { commentStatus: "running" },
    data: { commentStatus: "waiting", commentNextAt: null },
  });
  await prisma.postJob.updateMany({
    where: { reactionStatus: "running" },
    data: { reactionStatus: "waiting", reactionNextAt: null },
  });
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

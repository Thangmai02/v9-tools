import { appendJobLog } from "@/lib/job-log";
import { prisma } from "@/lib/db";

const OPEN = new Set(["queued", "running", "stopping", "preparing"]);

export function readPaceSeconds(value: unknown) {
  const delaySeconds = Number(value);
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 600) {
    throw new Error("Số giây chờ từ 0 đến 600. 0 là mức nhanh nhất, không đặt nhỏ hơn.");
  }
  return delaySeconds;
}

export async function stopBatch(batchId: string) {
  const batch = await prisma.postBatch.findUnique({
    where: { id: batchId },
    include: { jobs: { orderBy: { position: "asc" } } },
  });
  if (!batch) throw new Error("Không thấy đợt đăng.");
  if (!OPEN.has(batch.status) && batch.status !== "stopping") {
    throw new Error("Đợt này không còn đang chạy.");
  }
  if (batch.status === "stopping" && batch.stopAfterJobId) {
    const kept = batch.jobs.find((job) => job.id === batch.stopAfterJobId);
    return { status: "stopping" as const, pageName: kept?.pageName ?? null };
  }

  const running = batch.jobs.find((job) => job.status === "running");
  const pending = batch.jobs.filter((job) => job.status === "pending" || job.status === "queued");
  const keep = running ?? pending[0] ?? null;
  if (!keep) {
    await prisma.postBatch.update({
      where: { id: batchId },
      data: { status: "stopped", stopAfterJobId: null },
    });
    return { status: "stopped" as const, pageName: null };
  }

  const now = new Date();
  const drop = pending.filter((job) => job.id !== keep.id);
  await prisma.$transaction([
    prisma.postBatch.update({
      where: { id: batchId },
      data: { status: "stopping", stopAfterJobId: keep.id },
    }),
    ...drop.map((job) =>
      prisma.postJob.update({
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
      }),
    ),
  ]);

  await prisma.postJob.update({
    where: { id: keep.id },
    data: {
      runAt: !running && keep.runAt == null ? now : keep.runAt,
      stage: running ? keep.stage ?? "Đang đăng, xong sẽ dừng" : "Sắp đăng rồi dừng",
      log: appendJobLog(keep.log, "Đăng nốt Page này rồi dừng các Page còn lại."),
    },
  });

  return { status: "stopping" as const, pageName: keep.pageName };
}

export async function pauseBatch(batchId: string) {
  const batch = await prisma.postBatch.findUnique({
    where: { id: batchId },
    select: { status: true },
  });
  if (!batch) throw new Error("Không thấy đợt đăng.");
  if (batch.status === "paused") return { status: "paused" as const };
  if (!OPEN.has(batch.status) && batch.status !== "stopping") {
    throw new Error("Đợt này không còn đang chạy.");
  }
  await prisma.postBatch.update({
    where: { id: batchId },
    data: { status: "paused", stopAfterJobId: null },
  });
  return { status: "paused" as const };
}

export async function resumeBatch(batchId: string) {
  const batch = await prisma.postBatch.findUnique({
    where: { id: batchId },
    include: { jobs: true },
  });
  if (!batch) throw new Error("Không thấy đợt đăng.");
  if (batch.status !== "paused" && batch.status !== "stopping") {
    throw new Error("Đợt này không đang tạm dừng.");
  }
  const now = new Date();
  const waiting = batch.jobs.filter((job) => job.status === "pending" || job.status === "queued");
  await prisma.$transaction([
    prisma.postBatch.update({
      where: { id: batchId },
      data: { status: waiting.length > 0 ? "queued" : "running", stopAfterJobId: null },
    }),
    ...waiting.map((job) =>
      prisma.postJob.update({
        where: { id: job.id },
        data: {
          runAt: now,
          stage: "Tiếp tục",
          log: appendJobLog(job.log, "Tiếp tục đăng các bài còn lại."),
        },
      }),
    ),
  ]);
  return { status: "queued" as const };
}

const JOB_OPEN = new Set(["pending", "queued", "running", "preparing"]);
const FOLLOW_OPEN = new Set(["pending", "waiting", "running"]);

export async function forceStopBatch(batchId: string) {
  const batch = await prisma.postBatch.findUnique({
    where: { id: batchId },
    include: { jobs: true },
  });
  if (!batch) throw new Error("Không thấy đợt đăng.");
  const now = new Date();
  await prisma.$transaction([
    prisma.postBatch.update({
      where: { id: batchId },
      data: {
        status: "stopped",
        stopAfterJobId: null,
        completedAt: batch.completedAt ?? now,
      },
    }),
    ...batch.jobs
      .filter(
        (job) =>
          JOB_OPEN.has(job.status) ||
          FOLLOW_OPEN.has(job.commentStatus) ||
          FOLLOW_OPEN.has(job.reactionStatus),
      )
      .map((job) =>
        prisma.postJob.update({
          where: { id: job.id },
          data: {
            status: job.status === "success" ? "success" : "cancelled",
            stage: "Đã dừng",
            log: appendJobLog(
              job.log,
              job.status === "success"
                ? "Buộc dừng. Bài đã đăng thì giữ, không gửi bình luận hay Thích nữa."
                : "Buộc dừng. Bài này không đăng tiếp.",
            ),
            commentStatus: job.commentStatus === "success" ? "success" : "skipped",
            commentNextAt: null,
            reactionStatus: job.reactionStatus === "success" ? "success" : "skipped",
            reactionNextAt: null,
            error: null,
            finishedAt: job.finishedAt ?? now,
          },
        }),
      ),
  ]);
  return { status: "stopped" as const, pageName: null };
}

export async function setBatchPace(batchId: string, delaySeconds: number) {
  const batch = await prisma.postBatch.findUnique({
    where: { id: batchId },
    include: { jobs: { orderBy: { position: "asc" } } },
  });
  if (!batch) throw new Error("Không thấy đợt đăng.");
  if (!OPEN.has(batch.status)) {
    throw new Error("Đợt này không còn đang chạy.");
  }

  await prisma.postBatch.update({
    where: { id: batchId },
    data: { delaySeconds },
  });

  const next = batch.jobs.find(
    (job) => (job.status === "pending" || job.status === "queued") && job.runAt,
  );
  if (!next) return { delaySeconds, pageName: null as string | null };

  const done = batch.jobs
    .filter((job) => job.finishedAt && (job.status === "success" || job.status === "failed"))
    .sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime())[0];
  const anchor = done?.finishedAt ?? new Date();
  let runAt = new Date(anchor.getTime() + delaySeconds * 1000);
  if (runAt.getTime() < Date.now()) runAt = new Date();
  const text =
    delaySeconds === 0 ? "Đổi sang đăng ngay, không chờ." : `Đổi nhịp chờ còn ${delaySeconds} giây.`;

  await prisma.postJob.update({
    where: { id: next.id },
    data: {
      runAt,
      stage: delaySeconds === 0 ? "Đến lượt, đăng ngay" : `Chờ ${delaySeconds} giây rồi đăng`,
      log: appendJobLog(next.log, text),
    },
  });

  return { delaySeconds, pageName: next.pageName };
}

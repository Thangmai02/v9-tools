import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProUser } from "@/lib/auth";
import { resolvePageOwnerIds } from "@/lib/facebook-keys";
import { readBatchFields, saveBatch } from "@/lib/batches";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireProUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const user = gate.user;
  const batches = await prisma.postBatch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { jobs: { select: { status: true } } },
  });
  return NextResponse.json({
    batches: batches.map((batch) => ({
      id: batch.id,
      message: batch.message,
      link: batch.link,
      status: batch.status,
      delaySeconds: batch.delaySeconds,
      createdAt: batch.createdAt,
      counts: countJobs(batch.jobs),
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireProUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const user = gate.user;
  const pageOwnerIds = await resolvePageOwnerIds(user.id);
  if (pageOwnerIds.length === 0) {
    return NextResponse.json(
      { error: "Chưa có mã khóa Facebook. Admin cần thêm và gán mã." },
      { status: 400 },
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let image: File | null = null;
    let video: File | null = null;
    let cover: File | null = null;
    let commentImage: File | null = null;
    const pageImages = new Map<string, File>();
    const sharedCommentFiles = new Map<number, File>();
    const pageCommentFiles = new Map<string, File>();
    let fields;
    if (contentType.includes("application/json")) {
      fields = readBatchFields(await request.json());
    } else {
      const form = await request.formData();
      const imageFile = form.get("image");
      const videoFile = form.get("video");
      const coverFile = form.get("cover");
      const commentFile = form.get("commentImage");
      image = imageFile instanceof File ? imageFile : null;
      video = videoFile instanceof File ? videoFile : null;
      cover = coverFile instanceof File ? coverFile : null;
      commentImage = commentFile instanceof File && commentFile.size > 0 ? commentFile : null;
      for (const [key, value] of form.entries()) {
        if (!(value instanceof File) || value.size <= 0) continue;
        if (key.startsWith("commentImage_")) {
          pageImages.set(key.slice("commentImage_".length), value);
        }
        if (key.startsWith("commentFile_")) {
          const rest = key.slice("commentFile_".length);
          if (/^\d+$/.test(rest)) {
            sharedCommentFiles.set(Number(rest), value);
            continue;
          }
          const split = rest.lastIndexOf("_");
          if (split > 0 && /^\d+$/.test(rest.slice(split + 1))) {
            pageCommentFiles.set(`${rest.slice(0, split)}:${rest.slice(split + 1)}`, value);
          }
        }
      }
      fields = readBatchFields({
        action: form.get("action"),
        draftId: form.get("draftId"),
        message: form.get("message"),
        link: form.get("link"),
        delaySeconds: form.get("delaySeconds"),
        commentDelaySeconds: form.get("commentDelaySeconds"),
        pageIds: form.getAll("pageIds").map(String),
        commentEnabled: form.get("commentEnabled"),
        reactionEnabled: form.get("reactionEnabled"),
        reactionType: form.get("reactionType"),
        commentText: form.get("commentText"),
        separateComments: form.get("separateComments"),
        clearCommentImage: form.get("clearCommentImage"),
        pageComments: form.get("pageComments"),
        comments: form.get("comments"),
        scheduledAt: form.get("scheduledAt"),
        removeMedia: form.get("removeMedia"),
        clearCover: form.get("clearCover"),
      });
    }
    const saved = await saveBatch(
      user.id,
      {
        ...fields,
        image,
        video,
        cover,
        commentImage,
        comments: fields.comments?.map((slot, index) => ({
          ...slot,
          image: sharedCommentFiles.get(index) ?? null,
        })),
        pageComments: fields.pageComments?.map((row) => ({
          ...row,
          image: pageImages.get(row.pageId) ?? null,
          comments: row.comments?.map((slot, index) => ({
            ...slot,
            image: pageCommentFiles.get(`${row.pageId}:${index}`) ?? null,
          })),
        })),
      },
      pageOwnerIds,
    );
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được bài.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function countJobs(jobs: { status: string }[]) {
  return {
    success: jobs.filter((job) => job.status === "success").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    pending: jobs.filter((job) => job.status === "pending" || job.status === "queued").length,
    running: jobs.filter((job) => job.status === "running").length,
  };
}

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { parseStoredComments, type StoredComment } from "@/lib/comment-items";
import { prisma } from "@/lib/db";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const MAX_COVER_BYTES = 3 * 1024 * 1024;

const IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const VIDEO_TYPES = new Map([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
]);

const COVER_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

export type BatchAction = "draft" | "now" | "schedule";

export type CommentSlotInput = {
  text: string;
  clearImage: boolean;
  keepIndex: number | null;
  image?: File | null;
};

export type PageCommentInput = {
  pageId: string;
  text: string;
  clearImage: boolean;
  image?: File | null;
  comments?: CommentSlotInput[];
};

export type BatchInput = {
  action: BatchAction;
  draftId: string | null;
  message: string;
  link: string | null;
  delaySeconds: number;
  commentDelaySeconds: number;
  pageIds: string[];
  commentEnabled: boolean;
  commentText: string;
  separateComments: boolean;
  clearCommentImage: boolean;
  scheduledAt: Date | null;
  removeMedia: boolean;
  clearCover: boolean;
  image?: File | null;
  video?: File | null;
  cover?: File | null;
  commentImage?: File | null;
  comments?: CommentSlotInput[];
  pageComments?: PageCommentInput[];
};

function parseLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Link không hợp lệ.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Link phải bắt đầu bằng http hoặc https.");
  }
  return url.toString();
}

function sniffType(file: File, types: Map<string, string>) {
  if (file.type && types.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if ((name.endsWith(".jpg") || name.endsWith(".jpeg")) && types.has("image/jpeg")) return "image/jpeg";
  if (name.endsWith(".png") && types.has("image/png")) return "image/png";
  if (name.endsWith(".webp") && types.has("image/webp")) return "image/webp";
  if (name.endsWith(".mp4") && types.has("video/mp4")) return "video/mp4";
  if (name.endsWith(".webm") && types.has("video/webm")) return "video/webm";
  if (name.endsWith(".mov") && types.has("video/quicktime")) return "video/quicktime";
  return file.type;
}

function readPageComments(value: unknown) {
  if (value == null || value === "") return [];
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("Bình luận theo Page không hợp lệ.");
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    const row = item as {
      pageId?: unknown;
      text?: unknown;
      clearImage?: unknown;
      comments?: unknown;
    };
    const text = String(row.text ?? "").trim();
    if (text.length > 5000) throw new Error("Bình luận tối đa 5000 ký tự.");
    return {
      pageId: String(row.pageId ?? ""),
      text,
      clearImage: flag(row.clearImage),
      comments: readCommentSlots(row.comments),
    };
  }).filter((row) => row.pageId);
}

function readCommentSlots(value: unknown): CommentSlotInput[] {
  if (value == null || value === "") return [];
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("Danh sách bình luận không hợp lệ.");
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    const row = item as { text?: unknown; clearImage?: unknown; keepIndex?: unknown };
    const text = String(row.text ?? "").trim();
    if (text.length > 5000) throw new Error("Bình luận tối đa 5000 ký tự.");
    const keep = Number(row.keepIndex);
    return {
      text,
      clearImage: flag(row.clearImage),
      keepIndex: Number.isInteger(keep) && keep >= 0 ? keep : null,
    };
  });
}

function flag(value: unknown) {
  return value === true || value === "1" || value === "true" || value === "on";
}

function parseWhen(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const time = new Date(raw);
  if (Number.isNaN(time.getTime())) {
    throw new Error("Ngày giờ không hợp lệ.");
  }
  return time;
}

export function readBatchFields(source: {
  action?: unknown;
  draftId?: unknown;
  message?: unknown;
  link?: unknown;
  delaySeconds?: unknown;
  commentDelaySeconds?: unknown;
  pageIds?: unknown;
  commentEnabled?: unknown;
  commentText?: unknown;
  separateComments?: unknown;
  clearCommentImage?: unknown;
  pageComments?: unknown;
  comments?: unknown;
  scheduledAt?: unknown;
  removeMedia?: unknown;
  clearCover?: unknown;
}) {
  const action = String(source.action ?? "now");
  if (action !== "draft" && action !== "now" && action !== "schedule") {
    throw new Error("Thao tác không hợp lệ.");
  }
  const message = String(source.message ?? "").trim();
  if (message.length > 5000) {
    throw new Error("Nội dung tối đa 5000 ký tự.");
  }
  const link =
    source.link === undefined || source.link === null || String(source.link).trim() === ""
      ? null
      : parseLink(String(source.link));
  let delaySeconds = 45;
  if (
    source.delaySeconds !== undefined &&
    source.delaySeconds !== null &&
    String(source.delaySeconds) !== ""
  ) {
    delaySeconds = Number(source.delaySeconds);
    if (!Number.isInteger(delaySeconds) || (delaySeconds !== 0 && (delaySeconds < 10 || delaySeconds > 600))) {
      throw new Error("Đăng nhanh không chờ. Giả lập người dùng chờ từ 10 đến 600 giây.");
    }
  }
  let commentDelaySeconds = 0;
  if (
    source.commentDelaySeconds !== undefined &&
    source.commentDelaySeconds !== null &&
    String(source.commentDelaySeconds) !== ""
  ) {
    commentDelaySeconds = Number(source.commentDelaySeconds);
    if (
      !Number.isInteger(commentDelaySeconds) ||
      (commentDelaySeconds !== 0 && (commentDelaySeconds < 5 || commentDelaySeconds > 180))
    ) {
      throw new Error("Bình luận nhanh không chờ. Giả lập người dùng chờ từ 5 đến 180 giây.");
    }
  }
  const pageIds = Array.isArray(source.pageIds) ? source.pageIds.map(String) : [];
  const commentEnabled = flag(source.commentEnabled);
  const commentText = String(source.commentText ?? "").trim();
  if (commentText.length > 5000) {
    throw new Error("Bình luận tối đa 5000 ký tự.");
  }
  const pageComments = readPageComments(source.pageComments);
  const comments = readCommentSlots(source.comments);
  const scheduledAt = parseWhen(source.scheduledAt);
  if (action === "schedule") {
    if (!scheduledAt) throw new Error("Chọn ngày giờ đăng.");
    if (scheduledAt.getTime() < Date.now() + 60_000) {
      throw new Error("Giờ đăng phải sau ít nhất 1 phút.");
    }
    if (scheduledAt.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000) {
      throw new Error("Chỉ lên lịch trong 6 tháng tới.");
    }
  }
  const draftId = source.draftId ? String(source.draftId) : null;
  return {
    action: action as BatchAction,
    draftId,
    message,
    link,
    delaySeconds,
    commentDelaySeconds,
    pageIds,
    commentEnabled,
    commentText,
    separateComments: flag(source.separateComments),
    clearCommentImage: flag(source.clearCommentImage),
    pageComments,
    comments,
    scheduledAt: action === "now" ? null : scheduledAt,
    removeMedia: flag(source.removeMedia),
    clearCover: flag(source.clearCover),
  };
}

async function removeStored(relative: string | null) {
  if (!relative) return;
  const absolute = path.resolve(process.cwd(), relative);
  const root = path.resolve(process.cwd(), "data", "uploads") + path.sep;
  const left = process.platform === "win32" ? absolute.toLowerCase() : absolute;
  const right = process.platform === "win32" ? root.toLowerCase() : root;
  if (!left.startsWith(right)) return;
  await unlink(absolute).catch(() => undefined);
}

async function writeMedia(
  stem: string,
  file: File,
  extension: string,
  maxBytes: number,
  label: string,
) {
  if (file.size > maxBytes) {
    throw new Error(`${label} tối đa ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }
  const relative = path.join("data", "uploads", `${stem}${extension}`);
  const absolute = path.join(process.cwd(), relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return relative;
}

export async function saveBatch(
  userId: string,
  input: BatchInput,
  pageOwnerIds: string | string[] = userId,
) {
  const owners = Array.isArray(pageOwnerIds) ? pageOwnerIds : [pageOwnerIds];
  const image = input.image && input.image.size > 0 ? input.image : null;
  const video = input.video && input.video.size > 0 ? input.video : null;
  const cover = input.cover && input.cover.size > 0 ? input.cover : null;
  if (image && video) {
    throw new Error("Chỉ chọn ảnh hoặc video.");
  }
  const imageExt = image ? IMAGE_TYPES.get(sniffType(image, IMAGE_TYPES)) : null;
  const videoExt = video ? VIDEO_TYPES.get(sniffType(video, VIDEO_TYPES)) : null;
  const coverExt = cover ? COVER_TYPES.get(sniffType(cover, COVER_TYPES)) : null;
  if (image && !imageExt) throw new Error("Ảnh chỉ nhận JPG, PNG hoặc WEBP.");
  if (video && !videoExt) throw new Error("Video chỉ nhận MP4, WEBM hoặc MOV.");
  if (cover && !coverExt) throw new Error("Ảnh bìa chỉ nhận JPG, PNG hoặc WEBP.");

  const existing = input.draftId
    ? await prisma.postBatch.findFirst({
        where: { id: input.draftId, userId, status: "draft" },
      })
    : null;
  if (input.draftId && !existing) {
    throw new Error("Không thấy nháp để cập nhật.");
  }

  const uniqueIds = [...new Set(input.pageIds)];
  if (input.action !== "draft" && uniqueIds.length === 0) {
    throw new Error("Chọn ít nhất một Page.");
  }
  if (uniqueIds.length > 50) {
    throw new Error("Mỗi đợt tối đa 50 Page.");
  }

  const pages =
    uniqueIds.length === 0
      ? []
      : await prisma.page.findMany({
          where: { id: { in: uniqueIds }, account: { userId: { in: owners } } },
        });
  if (pages.length !== uniqueIds.length) {
    throw new Error("Có Page không còn trong danh sách admin đã gắn.");
  }
  const byId = new Map(pages.map((page) => [page.id, page]));

  const publishing = input.action !== "draft";
  const willHaveImage = Boolean(image) || Boolean(existing?.imagePath && !input.removeMedia && !video);
  const willHaveVideo = Boolean(video) || Boolean(existing?.videoPath && !input.removeMedia && !image);
  const hasMedia = input.removeMedia ? Boolean(image || video) : willHaveImage || willHaveVideo;
  if (publishing && !input.message && !hasMedia) {
    throw new Error("Cần nội dung, ảnh hoặc video.");
  }
  const pageHasComment = (input.pageComments ?? []).some(
    (row) =>
      row.text ||
      (row.image && row.image.size > 0) ||
      (row.comments ?? []).some((slot) => slot.text || (slot.image && slot.image.size > 0)),
  );
  const sharedHasComment = (input.comments ?? []).some(
    (slot) => slot.text || (slot.image && slot.image.size > 0),
  );
  if (!publishing && !input.message && !hasMedia && !input.commentText && !input.commentImage && !sharedHasComment && !pageHasComment) {
    throw new Error("Nháp cần nội dung hoặc tệp.");
  }
  if (cover && !willHaveVideo && !video) {
    throw new Error("Ảnh bìa chỉ dùng kèm video.");
  }

  const created = !existing;
  const batch =
    existing ??
    (await prisma.postBatch.create({
      data: {
        userId,
        message: input.message,
        link: input.link,
        delaySeconds: input.delaySeconds,
        commentDelaySeconds: input.commentDelaySeconds,
        status: "preparing",
      },
    }));

  try {
    let imagePath = input.removeMedia ? null : (existing?.imagePath ?? null);
    let videoPath = input.removeMedia ? null : (existing?.videoPath ?? null);
    let coverPath = input.removeMedia ? null : (existing?.coverPath ?? null);
    if (input.removeMedia) {
      await removeStored(existing?.imagePath ?? null);
      await removeStored(existing?.videoPath ?? null);
      await removeStored(existing?.coverPath ?? null);
    }
    if (image) {
      const nextImage = await writeMedia(batch.id, image, imageExt!, MAX_IMAGE_BYTES, "Ảnh");
      if (imagePath && imagePath !== nextImage) await removeStored(imagePath);
      await removeStored(videoPath);
      await removeStored(coverPath);
      imagePath = nextImage;
      videoPath = null;
      coverPath = null;
    }
    if (video) {
      const nextVideo = await writeMedia(batch.id, video, videoExt!, MAX_VIDEO_BYTES, "Video");
      await removeStored(imagePath);
      if (videoPath && videoPath !== nextVideo) await removeStored(videoPath);
      await removeStored(coverPath);
      videoPath = nextVideo;
      imagePath = null;
      coverPath = null;
    }
    if (cover) {
      if (!videoPath) throw new Error("Ảnh bìa chỉ dùng kèm video.");
      const nextCover = await writeMedia(
        `${batch.id}-cover`,
        cover,
        coverExt!,
        MAX_COVER_BYTES,
        "Ảnh bìa",
      );
      if (coverPath && coverPath !== nextCover) await removeStored(coverPath);
      coverPath = nextCover;
    } else if (input.clearCover) {
      await removeStored(coverPath);
      coverPath = null;
    }

    const oldJobs = existing
      ? await prisma.postJob.findMany({ where: { batchId: batch.id } })
      : [];
    const keptImages = new Set<string>();
    const oldPaths = new Set<string>();
    const remembered = (job: {
      commentItems: string | null;
      commentMessage: string | null;
      commentImagePath: string | null;
    }) => {
      const parsed = parseStoredComments(job.commentItems);
      if (parsed.length) return parsed;
      if (job.commentMessage || job.commentImagePath) {
        return [{ message: job.commentMessage, imagePath: job.commentImagePath }];
      }
      return [];
    };
    for (const job of oldJobs) {
      for (const item of remembered(job)) {
        if (item.imagePath) oldPaths.add(item.imagePath);
      }
    }
    if (existing?.commentImagePath) oldPaths.add(existing.commentImagePath);

    const placeSlots = async (
      slots: CommentSlotInput[],
      previous: StoredComment[],
      stem: string,
      who: string,
    ) => {
      const built: StoredComment[] = [];
      for (let index = 0; index < slots.length; index += 1) {
        const slot = slots[index];
        const earlier = slot.keepIndex != null ? previous[slot.keepIndex]?.imagePath ?? null : null;
        let imagePath = slot.clearImage ? null : earlier;
        if (slot.image && slot.image.size > 0) {
          const ext = IMAGE_TYPES.get(sniffType(slot.image, IMAGE_TYPES));
          if (!ext) throw new Error("Ảnh bình luận chỉ nhận JPG, PNG hoặc WEBP.");
          imagePath = await writeMedia(
            `${stem}-${index}`,
            slot.image,
            ext,
            MAX_IMAGE_BYTES,
            "Ảnh bình luận",
          );
        }
        if (imagePath) keptImages.add(imagePath);
        if (publishing && !slot.text && !imagePath) {
          throw new Error(
            who
              ? `Nhập chữ hoặc ảnh cho bình luận ${index + 1} của ${who}.`
              : `Nhập chữ hoặc ảnh cho bình luận ${index + 1}.`,
          );
        }
        built.push({ message: slot.text || null, imagePath });
      }
      return built;
    };

    let sharedBuilt: StoredComment[] = [];
    if (input.commentEnabled && !input.separateComments) {
      const slots = input.comments?.length
        ? input.comments
        : [
            {
              text: input.commentText,
              clearImage: input.clearCommentImage,
              keepIndex: input.clearCommentImage ? null : 0,
              image: input.commentImage,
            },
          ];
      const previous = oldJobs[0] ? remembered(oldJobs[0]) : [];
      sharedBuilt = await placeSlots(slots, previous, `${batch.id}-comment`, "");
      if (publishing && !sharedBuilt.some((item) => item.message || item.imagePath)) {
        throw new Error("Nhập chữ hoặc chọn ảnh bình luận, hoặc tắt bình luận tự động.");
      }
    }

    const jobComments: StoredComment[][] = [];
    for (const id of uniqueIds) {
      const page = byId.get(id)!;
      if (!input.commentEnabled) {
        jobComments.push([]);
        continue;
      }
      if (!input.separateComments) {
        jobComments.push(sharedBuilt);
        continue;
      }
      const spec = input.pageComments?.find((row) => row.pageId === id);
      const slots = spec?.comments?.length
        ? spec.comments
        : [
            {
              text: spec?.text ?? "",
              clearImage: spec?.clearImage ?? false,
              keepIndex: spec?.clearImage ? null : 0,
              image: spec?.image,
            },
          ];
      const old = oldJobs.find((job) => job.fbPageId === page.pageId);
      const built = await placeSlots(slots, old ? remembered(old) : [], `${batch.id}-c-${id}`, page.name);
      if (publishing && !built.some((item) => item.message || item.imagePath)) {
        throw new Error(`Nhập chữ hoặc ảnh bình luận cho ${page.name}.`);
      }
      jobComments.push(built);
    }
    for (const relative of oldPaths) {
      if (!keptImages.has(relative)) await removeStored(relative);
    }
    const firstShared = sharedBuilt.find((item) => item.message || item.imagePath) ?? null;

    const firstRun = input.scheduledAt ?? new Date();
    await prisma.postJob.deleteMany({ where: { batchId: batch.id } });
    if (uniqueIds.length > 0) {
      await prisma.postJob.createMany({
        data: uniqueIds.map((id, position) => {
          const page = byId.get(id)!;
          const items = jobComments[position] ?? [];
          const first = items.find((item) => item.message || item.imagePath) ?? null;
          return {
            batchId: batch.id,
            fbPageId: page.pageId,
            pageName: page.name,
            position,
            status: publishing ? "pending" : "draft",
            runAt: publishing && position === 0 ? firstRun : null,
            commentStatus: "skipped",
            commentMessage: first?.message ?? null,
            commentImagePath: first?.imagePath ?? null,
            commentItems: items.length ? JSON.stringify(items) : null,
            commentSent: 0,
          };
        }),
      });
    }

    await prisma.postBatch.update({
      where: { id: batch.id },
      data: {
        message: input.message,
        link: input.link,
        delaySeconds: input.delaySeconds,
        commentDelaySeconds: input.commentDelaySeconds,
        commentEnabled: input.commentEnabled,
        commentText: input.separateComments ? null : firstShared?.message ?? null,
        commentImagePath: input.separateComments ? null : firstShared?.imagePath ?? null,
        separateComments: input.separateComments,
        scheduledAt: input.scheduledAt,
        imagePath,
        videoPath,
        coverPath,
        status: publishing ? "queued" : "draft",
      },
    });
  } catch (error) {
    if (created) {
      await prisma.postBatch.delete({ where: { id: batch.id } }).catch(() => undefined);
    }
    if (error instanceof Error && error.message !== "Không xếp được hàng đăng.") {
      throw error;
    }
    throw new Error("Không lưu được bài.");
  }

  return { id: batch.id, status: publishing ? "queued" : "draft" };
}

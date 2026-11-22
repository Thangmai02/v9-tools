import { open, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveMember } from "@/lib/auth";
import { parseStoredComments } from "@/lib/comment-items";
import { uploadAbsolute } from "@/lib/publish";

export const runtime = "nodejs";

function contentType(relative: string, which: string) {
  if (which === "video") {
    if (relative.endsWith(".webm")) return "video/webm";
    if (relative.endsWith(".mov")) return "video/quicktime";
    return "video/mp4";
  }
  if (relative.endsWith(".png")) return "image/png";
  if (relative.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await resolveMember();
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }
  const { id } = await context.params;
  const url = new URL(request.url);
  const which = url.searchParams.get("which");
  const jobId = url.searchParams.get("job");
  const index = Number(url.searchParams.get("index") ?? "0");
  const batch = await prisma.postBatch.findFirst({
    where: { id, userId: user.id },
    include: { jobs: { select: { id: true, commentImagePath: true, commentItems: true } } },
  });
  if (!batch) {
    return NextResponse.json({ error: "Không thấy bài." }, { status: 404 });
  }
  const job = which === "job-comment" ? batch.jobs.find((item) => item.id === jobId) : null;
  const stored = parseStoredComments(job?.commentItems);
  const jobImage =
    stored[index]?.imagePath ?? (index === 0 ? job?.commentImagePath ?? null : null);
  const relative =
    which === "image"
      ? batch.imagePath
      : which === "video"
        ? batch.videoPath
        : which === "cover"
          ? batch.coverPath
          : which === "comment"
            ? batch.commentImagePath
            : which === "job-comment"
              ? jobImage
              : null;
  if (
    !relative ||
    (which !== "image" &&
      which !== "video" &&
      which !== "cover" &&
      which !== "comment" &&
      which !== "job-comment")
  ) {
    return NextResponse.json({ error: "Không thấy tệp." }, { status: 404 });
  }

  let absolute: string;
  try {
    absolute = uploadAbsolute(relative);
  } catch {
    return NextResponse.json({ error: "Tệp không hợp lệ." }, { status: 400 });
  }

  const info = await stat(absolute).catch(() => null);
  if (!info) {
    return NextResponse.json({ error: "Tệp không còn." }, { status: 404 });
  }

  const type = contentType(relative, which);
  const size = info.size;
  const range = which === "video" ? request.headers.get("range") : null;
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      return new NextResponse(null, { status: 416 });
    }
    const start = Number(match[1]);
    if (start >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    let end = match[2] ? Number(match[2]) : size - 1;
    if (end >= size) end = size - 1;
    const maxChunk = 2 * 1024 * 1024;
    if (end - start + 1 > maxChunk) end = start + maxChunk - 1;
    const length = end - start + 1;
    const handle = await open(absolute, "r");
    try {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);
      return new NextResponse(new Uint8Array(buffer), {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(length),
          "Cache-Control": "private, max-age=3600",
        },
      });
    } finally {
      await handle.close();
    }
  }

  const handle = await open(absolute, "r");
  try {
    const buffer = Buffer.alloc(size);
    await handle.read(buffer, 0, size, 0);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Length": String(size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } finally {
    await handle.close();
  }
}

import { readFile } from "fs/promises";
import path from "path";
import { GRAPH, GraphError, graphRequest } from "@/lib/graph";

export function pageScopedPostId(pageId: string, postId: string) {
  const raw = postId.trim();
  if (!raw || raw.includes("_")) return raw;
  return `${pageId}_${raw}`;
}

export function captionForPhoto(message: string, link: string | null) {
  const text = message.trim();
  if (!link) return text;
  if (text.includes(link)) return text;
  return text ? `${text}\n${link}` : link;
}

export function uploadAbsolute(filePath: string) {
  const absolute = path.resolve(process.cwd(), filePath);
  const uploadsRoot = path.resolve(process.cwd(), "data", "uploads") + path.sep;
  const left = process.platform === "win32" ? absolute.toLowerCase() : absolute;
  const right = process.platform === "win32" ? uploadsRoot.toLowerCase() : uploadsRoot;
  if (!left.startsWith(right)) {
    throw new GraphError("Đường dẫn tệp không hợp lệ.");
  }
  return absolute;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function publishFeed(input: {
  pageId: string;
  token: string;
  message: string;
  link: string | null;
}) {
  const body = new URLSearchParams();
  body.set("message", input.message);
  body.set("published", "true");
  body.set("access_token", input.token);
  if (input.link) body.set("link", input.link);

  const result = await graphRequest(`${GRAPH}/${input.pageId}/feed`, {
    method: "POST",
    body,
  });
  if (typeof result.id !== "string" || !result.id) {
    throw new GraphError("Facebook không trả id bài viết.");
  }
  return pageScopedPostId(input.pageId, result.id);
}

export async function publishPhoto(input: {
  pageId: string;
  token: string;
  caption: string;
  filePath: string;
}) {
  const absolute = uploadAbsolute(input.filePath);
  const bytes = await readFile(absolute);
  const form = new FormData();
  form.set("caption", input.caption);
  form.set("published", "true");
  form.set("access_token", input.token);
  form.set("source", new Blob([new Uint8Array(bytes)]), path.basename(absolute));

  const result = await graphRequest(`${GRAPH}/${input.pageId}/photos`, {
    method: "POST",
    body: form,
  });
  const storyId = typeof result.post_id === "string" ? result.post_id : "";
  const photoId = typeof result.id === "string" ? result.id : "";
  const postId = storyId ? pageScopedPostId(input.pageId, storyId) : photoId;
  if (!postId) {
    throw new GraphError("Facebook không trả id bài viết.");
  }
  return postId;
}

export async function publishVideo(input: {
  pageId: string;
  token: string;
  description: string;
  filePath: string;
  coverPath: string | null;
}) {
  const absolute = uploadAbsolute(input.filePath);
  const bytes = await readFile(absolute);
  const form = new FormData();
  form.set("description", input.description);
  form.set("published", "true");
  form.set("access_token", input.token);
  form.set("source", new Blob([new Uint8Array(bytes)]), path.basename(absolute));

  const result = await graphRequest(`${GRAPH}/${input.pageId}/videos`, {
    method: "POST",
    body: form,
  });
  const videoId = typeof result.id === "string" ? result.id : "";
  if (!videoId) {
    throw new GraphError("Facebook không trả id video.");
  }

  let coverWarning: string | null = null;
  if (input.coverPath) {
    try {
      const coverAbsolute = uploadAbsolute(input.coverPath);
      const coverBytes = await readFile(coverAbsolute);
      const thumb = new FormData();
      thumb.set("access_token", input.token);
      thumb.set("is_preferred", "true");
      thumb.set(
        "source",
        new Blob([new Uint8Array(coverBytes)], { type: "image/jpeg" }),
        "cover.jpg",
      );
      await graphRequest(`${GRAPH}/${videoId}/thumbnails`, {
        method: "POST",
        body: thumb,
      });
    } catch {
      coverWarning =
        "Facebook không nhận ảnh bìa cho video này. Bài vẫn được đăng, Facebook dùng ảnh bìa mặc định.";
    }
  }

  const storyId = await waitForFeedPostId(videoId, input.token);
  return {
    postId: storyId ? pageScopedPostId(input.pageId, storyId) : videoId,
    coverWarning,
  };
}

async function waitForFeedPostId(videoId: string, token: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const body = await graphRequest(
        `${GRAPH}/${videoId}?fields=post_id&access_token=${encodeURIComponent(token)}`,
      );
      if (typeof body.post_id === "string" && body.post_id) return body.post_id;
    } catch {
      // Video đang xử lý, thử lại.
    }
    await sleep(3000);
  }
  return null;
}

async function postComment(targetId: string, input: {
  token: string;
  message: string;
  imagePath?: string | null;
}) {
  if (input.imagePath) {
    const absolute = uploadAbsolute(input.imagePath);
    const bytes = await readFile(absolute);
    const form = new FormData();
    if (input.message) form.set("message", input.message);
    form.set("access_token", input.token);
    form.set("source", new Blob([new Uint8Array(bytes)]), path.basename(absolute));
    const result = await graphRequest(`${GRAPH}/${targetId}/comments`, {
      method: "POST",
      body: form,
    });
    if (typeof result.id !== "string" || !result.id) {
      throw new GraphError("Facebook không trả id bình luận.");
    }
    return result.id;
  }

  const body = new URLSearchParams();
  body.set("message", input.message);
  body.set("access_token", input.token);
  const result = await graphRequest(`${GRAPH}/${targetId}/comments`, {
    method: "POST",
    body,
  });
  if (typeof result.id !== "string" || !result.id) {
    throw new GraphError("Facebook không trả id bình luận.");
  }
  return result.id;
}

export async function commentAsPage(input: {
  pageId: string;
  postId: string;
  token: string;
  message: string;
  imagePath?: string | null;
}) {
  const target = pageScopedPostId(input.pageId, input.postId);
  try {
    return await postComment(target, input);
  } catch (error) {
    const missingObject =
      error instanceof GraphError && (error.code === 100 || error.code === 803);
    if (target !== input.postId && missingObject) {
      return await postComment(input.postId, input);
    }
    throw error;
  }
}

export type StoredComment = {
  message: string | null;
  imagePath: string | null;
};

export function parseStoredComments(raw: string | null | undefined): StoredComment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const row = item as { message?: unknown; imagePath?: unknown };
      const message = String(row.message ?? "").trim();
      const imagePath = String(row.imagePath ?? "").trim();
      return {
        message: message || null,
        imagePath: imagePath || null,
      };
    });
  } catch {
    return [];
  }
}

export function commentHasContent(items: StoredComment[]) {
  return items.some((item) => item.message || item.imagePath);
}

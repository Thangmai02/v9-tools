export type JobLogLine = { t: string; m: string };

export function parseJobLog(raw: string | null | undefined): JobLogLine[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { t?: unknown; m?: unknown };
      if (typeof row.t !== "string" || typeof row.m !== "string") return [];
      return [{ t: row.t, m: row.m }];
    });
  } catch {
    return [];
  }
}

export function appendJobLog(raw: string | null | undefined, message: string) {
  const lines = parseJobLog(raw);
  lines.push({ t: new Date().toISOString(), m: message });
  return JSON.stringify(lines.slice(-40));
}

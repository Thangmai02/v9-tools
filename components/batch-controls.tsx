"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/components/ui";
import type { JobLogLine } from "@/lib/job-log";

const ACTIVE = new Set(["queued", "running", "stopping", "preparing"]);

function secondsLeft(runAt: string) {
  return Math.max(0, Math.ceil((new Date(runAt).getTime() - Date.now()) / 1000));
}

function formatLeft(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes > 0) return `${minutes} phút ${rest} giây`;
  return `${rest} giây`;
}

export function WaitLine({ runAt }: { runAt: string }) {
  const [left, setLeft] = useState(() => secondsLeft(runAt));
  useEffect(() => {
    const id = window.setInterval(() => setLeft(secondsLeft(runAt)), 1000);
    return () => window.clearInterval(id);
  }, [runAt]);
  if (left <= 0) return <span>Đến lượt, sắp đăng</span>;
  return <span>Còn {formatLeft(left)} rồi đăng</span>;
}

export function JobLogList({ lines }: { lines?: JobLogLine[] | null }) {
  if (!lines?.length) return null;
  return (
    <ol className="mt-2 space-y-0.5">
      {lines.slice(-6).map((line, index) => (
        <li key={`${line.t}-${index}`} className="text-[11px] leading-4 text-muted">
          <span className="tabular-nums text-ink/80">{formatClock(line.t)}</span> {line.m}
        </li>
      ))}
    </ol>
  );
}

export function BatchRunControls({
  id,
  status,
  delaySeconds,
  onChanged,
}: {
  id: string;
  status: string;
  delaySeconds: number;
  onChanged?: () => void;
}) {
  const [seconds, setSeconds] = useState(String(delaySeconds));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"stop" | "pace" | null>(null);

  useEffect(() => {
    setSeconds(String(delaySeconds));
  }, [delaySeconds]);

  if (!ACTIVE.has(status)) return null;

  async function applyPace() {
    const delay = Number(seconds);
    setBusy("pace");
    setError("");
    setNote("");
    const response = await fetch(`/api/batches/${id}/pace`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ delaySeconds: delay }),
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setError(data.error || "Không đổi được nhịp.");
      return;
    }
    setNote(delay === 0 ? "Page sau sẽ đăng ngay." : `Page sau chờ ${delay} giây.`);
    onChanged?.();
  }

  async function stop() {
    setBusy("stop");
    setError("");
    setNote("");
    const response = await fetch(`/api/batches/${id}/stop`, { method: "POST" });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setError(data.error || "Không dừng được.");
      return;
    }
    setNote(
      data.pageName
        ? `Đăng nốt ${data.pageName} rồi dừng.`
        : "Đã dừng. Không còn Page nào đang chờ.",
    );
    onChanged?.();
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper/50 p-3">
      <p className="text-xs leading-5 text-muted">
        {status === "stopping"
          ? "Đang đăng nốt Page gần nhất. Có thể đặt 0 giây để Page đó đăng ngay."
          : "Đổi giây chờ cho Page chưa đăng, hoặc dừng sau bài gần nhất."}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-ink">
          Giây chờ Page sau
          <input
            value={seconds}
            onChange={(event) => setSeconds(event.target.value)}
            type="number"
            min={0}
            max={600}
            disabled={busy !== null}
            className="mt-1 h-9 w-24 rounded-lg border border-line bg-surface px-2 text-sm text-ink"
          />
        </label>
        <button
          type="button"
          onClick={applyPace}
          disabled={busy !== null}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink hover:border-pine/40 disabled:opacity-50"
        >
          {busy === "pace" ? "Đang áp dụng..." : "Áp dụng"}
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={busy !== null || status === "stopping"}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-danger/30 bg-surface px-3 text-xs font-semibold text-danger hover:bg-danger/5 disabled:opacity-50"
        >
          {status === "stopping" ? "Sẽ dừng sau bài này" : busy === "stop" ? "Đang dừng..." : "Dừng sau bài này"}
        </button>
      </div>
      {note ? <p className="text-xs text-pine">{note}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

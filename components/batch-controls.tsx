"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/components/ui";
import type { JobLogLine } from "@/lib/job-log";

const ACTIVE = new Set(["queued", "running", "stopping", "preparing", "paused"]);

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
  ids,
  status,
  delaySeconds,
  onChanged,
  onForceStop,
}: {
  id: string;
  ids?: string[];
  status: string;
  delaySeconds: number;
  onChanged?: () => void;
  onForceStop?: () => void;
}) {
  const [seconds, setSeconds] = useState(String(delaySeconds));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"pause" | "resume" | "force" | "pace" | null>(null);

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

  async function run(action: "pause" | "resume" | "force") {
    setBusy(action);
    setError("");
    setNote("");
    const targets = [...new Set((ids && ids.length > 0 ? ids : [id]).filter(Boolean))];
    for (const target of targets) {
      const response = await fetch(`/api/batches/${target}/stop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBusy(null);
        setError(data.error || "Không làm được.");
        return;
      }
    }
    setBusy(null);
    if (action === "force") {
      setNote("Đã ngưng hết. Bài chưa tải xong không đăng tiếp.");
      onForceStop?.();
      return;
    }
    setNote(action === "pause" ? "Đã tạm dừng. Bài chưa đăng vẫn giữ." : "Đã tiếp tục các bài còn lại.");
    onChanged?.();
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper/50 p-3">
      <p className="text-xs leading-5 text-muted">
        {status === "paused" || status === "stopping"
          ? "Đang tạm dừng. Tiếp tục để đăng các bài còn lại. Buộc dừng thì ngưng hẳn."
          : "Tạm dừng giữ bài chưa đăng. Buộc dừng thì ngưng hẳn, không tiếp tục được."}
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
        {status === "paused" || status === "stopping" ? (
          <button
            type="button"
            onClick={() => run("resume")}
            disabled={busy !== null}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink hover:border-pine/40 disabled:opacity-50"
          >
            {busy === "resume" ? "Đang tiếp tục..." : "Tiếp tục"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run("pause")}
            disabled={busy !== null}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink hover:border-pine/40 disabled:opacity-50"
          >
            {busy === "pause" ? "Đang dừng..." : "Tạm dừng"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("force")}
          disabled={busy !== null}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-danger/30 bg-surface px-3 text-xs font-semibold text-danger hover:bg-danger/5 disabled:opacity-50"
        >
          {busy === "force" ? "Đang ngưng..." : "Buộc dừng"}
        </button>
      </div>
      {note ? <p className="text-xs text-pine">{note}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

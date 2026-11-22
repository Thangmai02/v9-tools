import type { ReactNode } from "react";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-pine/30 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export const fieldClass = `h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-[0_1px_2px_rgba(27,25,20,0.04)] transition placeholder:text-muted/70 focus:border-pine ${focusRing}`;

export const areaClass = `w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink shadow-[0_1px_2px_rgba(27,25,20,0.04)] transition placeholder:text-muted/70 focus:border-pine ${focusRing}`;

export const fileFieldClass =
  "flex h-11 w-full items-center rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-[0_1px_2px_rgba(27,25,20,0.04)] file:mr-3 file:rounded-md file:border-0 file:bg-pine/10 file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-pine";

export const buttonClass = `inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-moss px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,110,86,0.28)] transition hover:bg-moss-dark disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const quietButtonClass = `inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(27,25,20,0.04)] transition hover:border-pine/40 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const dangerButtonClass = `inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-danger/30 bg-surface px-3.5 text-sm font-semibold text-danger shadow-[0_1px_2px_rgba(27,25,20,0.04)] transition hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 focus-visible:ring-offset-2 focus-visible:ring-offset-paper`;

export const cardClass =
  "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(27,25,20,0.04),0_10px_28px_rgba(27,25,20,0.05)]";

export const labelClass = "block text-sm font-medium text-ink";

export const linkClass =
  "font-medium text-pine underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/30";

/** Lề hai mép trang — bám cạnh viewport, không co giữa khi thu phóng. */
export const shellPad = "px-4 sm:px-5 lg:px-6 xl:px-8";
export const shellClass = `w-full ${shellPad}`;

export function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "Chờ đăng",
    draft: "Nháp",
    preparing: "Đang chuẩn bị",
    running: "Đang đăng",
    finished: "Đã xong",
    pending: "Chờ",
    success: "Đã đăng",
    failed: "Lỗi đăng",
    skipped: "Không bình luận",
    free: "Thường",
    pro: "Pro",
  };
  return labels[status] ?? status;
}

function statusBadgeClass(status: string) {
  const base =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";
  if (status === "success" || status === "finished" || status === "pro") {
    return `${base} bg-moss text-white`;
  }
  if (status === "failed") {
    return `${base} bg-danger/10 text-danger ring-1 ring-inset ring-danger/25`;
  }
  if (status === "running" || status === "preparing") {
    return `${base} bg-surface text-pine ring-1 ring-inset ring-pine/40`;
  }
  if (status === "free" || status === "pending" || status === "queued") {
    return `${base} bg-amber/10 text-amber ring-1 ring-inset ring-amber/25`;
  }
  return `${base} bg-paper text-muted ring-1 ring-inset ring-line`;
}

function statusDotClass(status: string) {
  if (status === "failed") return "h-1.5 w-1.5 rounded-full bg-danger";
  if (status === "running" || status === "preparing") return "h-1.5 w-1.5 rounded-full bg-pine";
  if (status === "free" || status === "pending" || status === "queued") {
    return "h-1.5 w-1.5 rounded-full bg-amber";
  }
  return "h-1.5 w-1.5 rounded-full bg-muted";
}

export function StatusBadge({ status }: { status: string }) {
  const solid = status === "success" || status === "finished" || status === "pro";
  return (
    <span className={statusBadgeClass(status)}>
      {solid ? null : <span className={statusDotClass(status)} aria-hidden />}
      {statusLabel(status)}
    </span>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "amber" | "pine";
  children: ReactNode;
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber/10 text-amber ring-1 ring-inset ring-amber/25"
      : "bg-pine/10 text-pine ring-1 ring-inset ring-pine/20";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm leading-5 text-danger">{children}</p>
  );
}

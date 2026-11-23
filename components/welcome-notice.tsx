"use client";

import { useEffect, useState } from "react";

export function WelcomeNotice({ name, admin = false }: { name?: string; admin?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("welcome") !== "1") return;
    url.searchParams.delete("welcome");
    const query = url.searchParams.toString();
    window.history.replaceState(null, "", `${url.pathname}${query ? `?${query}` : ""}${url.hash}`);
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), 5200);
    return () => window.clearTimeout(timer);
  }, []);

  if (!open) return null;

  const who = name?.trim();
  const title = who ? `Chào mừng, ${who}` : "Chào mừng bạn trở lại";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_rgba(27,25,20,0.16)]"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss text-sm font-semibold text-white">
            {Array.from(who || "V")[0]?.toLocaleUpperCase("vi")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {admin
                ? "Tài khoản admin có toàn quyền trên tool."
                : "Bạn đã đăng nhập. Có thể bắt đầu soạn và đăng bài."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-paper hover:text-ink"
            aria-label="Đóng thông báo"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M5 5l10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

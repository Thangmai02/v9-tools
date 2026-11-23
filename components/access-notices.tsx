"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { accessChanges, type AccessSnap } from "@/lib/access-notice";
import { formatWhen } from "@/components/ui";

type Notice = {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  source: "local" | "server";
  holdMs?: number;
};

type ServerNotice = {
  id: string;
  title: string;
  body: string;
  at: string;
  presented: boolean;
  read: boolean;
};

const STORAGE = "v9-access-notices";

function loadNotices(): Notice[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const row = item as Partial<Notice>;
      if (!row.id || !row.title || !row.body || !row.at) return [];
      return [{
        id: row.id,
        title: row.title,
        body: row.body,
        at: row.at,
        read: Boolean(row.read),
        source: "local" as const,
      }];
    }).slice(0, 20);
  } catch {
    return [];
  }
}

function saveNotices(items: Notice[]) {
  const local = items.filter((item) => item.source !== "server").slice(0, 20);
  localStorage.setItem(STORAGE, JSON.stringify(local));
}

function syncProTheme(pro: boolean) {
  document.documentElement.classList.toggle("pro-neon", pro);
  if (pro) document.documentElement.dataset.pro = "true";
  else delete document.documentElement.dataset.pro;
}

export function AccessNotices() {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const baseline = useRef<AccessSnap | null>(null);
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [toast, setToast] = useState<Notice | null>(null);

  useEffect(() => {
    setNotices(loadNotices());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.holdMs ?? 6400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    let flying = false;

    async function tick() {
      if (stop || flying || document.hidden) return;
      flying = true;
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await response.json()) as {
          role?: string;
          access?: AccessSnap;
        };
        if (stop || data.role !== "member" || !data.access) return;
        const next = data.access;
        syncProTheme(next.pro);
        const prev = baseline.current;
        baseline.current = next;
        if (!prev) return;
        const notes = accessChanges(prev, next);
        if (!notes.length) return;
        const stamped = notes.map((note) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: note.title,
          body: note.body,
          at: new Date().toISOString(),
          read: false,
          source: "local" as const,
        }));
        setNotices((current) => {
          const merged = [...stamped, ...current].slice(0, 20);
          saveNotices(merged);
          return merged;
        });
        setToast(
          stamped.length === 1
            ? stamped[0]
            : {
                id: stamped[0].id,
                title: "Quyền tài khoản vừa đổi",
                body: stamped.map((note) => note.body).join(" "),
                at: stamped[0].at,
                read: false,
                source: "local",
              },
        );
        router.refresh();
      } catch {
        // Lần sau sẽ hỏi lại.
      } finally {
        flying = false;
      }
    }

    function loop() {
      void tick();
      timer = window.setTimeout(loop, 4000);
    }

    loop();
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    let flying = false;
    const shown = new Set<string>();

    async function pull() {
      if (stop || flying) return;
      flying = true;
      try {
        const response = await fetch("/api/notices", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { notices?: ServerNotice[] };
        const incoming = data.notices ?? [];
        if (stop) return;
        setNotices((current) => {
          const local = current.filter((item) => item.source !== "server");
          const server = incoming.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            at: item.at,
            read: item.read,
            source: "server" as const,
            holdMs: 3000,
          }));
          return [...server, ...local].slice(0, 30);
        });
        const fresh = incoming.filter((item) => !item.presented && !shown.has(item.id));
        if (!fresh.length || document.hidden) return;
        fresh.forEach((item) => shown.add(item.id));
        await fetch("/api/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "presented", ids: fresh.map((item) => item.id) }),
        });
        if (stop) return;
        const newest = fresh[0];
        setToast({
          id: newest.id,
          title: newest.title,
          body: fresh.length > 1 ? fresh.map((item) => item.body).join(" ") : newest.body,
          at: newest.at,
          read: false,
          source: "server",
          holdMs: 3000,
        });
      } catch {
        // Lần sau sẽ hỏi lại.
      } finally {
        flying = false;
      }
    }

    function loop() {
      if (!document.hidden) void pull();
      timer = window.setTimeout(loop, 4000);
    }

    loop();
    const onVisible = () => {
      if (!document.hidden) void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const unread = notices.filter((notice) => !notice.read).length;

  function toggle() {
    setOpen((value) => {
      const next = !value;
      if (next && unread) {
        setNotices((current) => {
          const read = current.map((notice) => ({ ...notice, read: true }));
          saveNotices(read);
          const ids = current.filter((notice) => notice.source === "server" && !notice.read).map((notice) => notice.id);
          if (ids.length) {
            void fetch("/api/notices", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "read", ids }),
            });
          }
          return read;
        });
      }
      return next;
    });
  }

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          aria-label={unread ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={toggle}
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-pine/30 hover:bg-paper"
        >
          <BellIcon />
          {unread ? (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-moss px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
        {open ? (
          <div
            id={menuId}
            className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_40px_rgba(27,25,20,0.16)]"
          >
            <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Thông báo</p>
            {notices.length ? (
              <ul className="max-h-80 overflow-y-auto">
                {notices.map((notice) => (
                  <li key={notice.id} className="border-b border-line/80 px-4 py-3 last:border-b-0">
                    <p className="text-sm font-semibold text-ink">{notice.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted">{notice.body}</p>
                    <p className="mt-1 text-[11px] text-muted">{formatWhen(notice.at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted">Chưa có thông báo.</p>
            )}
          </div>
        ) : null}
      </div>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_rgba(27,25,20,0.16)]"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss text-white">
                <BellIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{toast.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{toast.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
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
      ) : null}
    </>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinejoin="round" d="M5.2 8.6a4.8 4.8 0 0 1 9.6 0c0 3.2 1.2 4.2 1.2 4.2H4s1.2-1 1.2-4.2Z" />
      <path strokeLinecap="round" d="M8.4 15.4a1.7 1.7 0 0 0 3.2 0" />
    </svg>
  );
}

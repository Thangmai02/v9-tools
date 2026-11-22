"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/top-bar";

const items = [
  {
    id: "post",
    href: "/tool",
    label: "Auto Đăng Bài",
    hint: "Soạn và đăng lên Fanpage",
    Icon: AutoPostIcon,
  },
] as const;

export type ToolSection = (typeof items)[number]["id"];

const storageKey = "v9-tool-sidebar";

export function ToolShell({
  email,
  name,
  avatarUrl,
  pro = false,
  admin = false,
  active,
  children,
}: {
  email: string;
  name: string;
  avatarUrl?: string | null;
  pro?: boolean;
  admin?: boolean;
  active: ToolSection;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem(storageKey) !== "0");
    setReady(true);
  }, []);

  function toggle() {
    setOpen((value) => {
      const next = !value;
      localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <TopBar
      email={email}
      name={name}
      avatarUrl={avatarUrl}
      pro={pro}
      admin={admin}
      adminNav={admin}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <aside
          className={`shrink-0 border-b border-line bg-card/55 backdrop-blur-[2px] transition-[width] duration-200 lg:border-b-0 lg:border-r lg:border-line ${
            open ? "lg:w-60" : "lg:w-16"
          } ${ready ? "" : "lg:w-60"}`}
        >
          <div className={`flex items-center gap-2 px-3 pt-4 ${open ? "justify-between px-4" : "justify-center"}`}>
            {open ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Công cụ</p>
            ) : null}
            <button
              type="button"
              onClick={toggle}
              aria-pressed={open}
              aria-label={open ? "Ẩn thanh công cụ" : "Hiện thanh công cụ"}
              title={open ? "Ẩn thanh công cụ" : "Hiện thanh công cụ"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:border-pine/40 hover:bg-paper"
            >
              <SidebarIcon open={open} />
            </button>
          </div>
          {open ? (
            <nav className="mt-3 flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-y-auto">
              {items.map((item) => {
                const on = item.id === active;
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-w-[11rem] items-start gap-3 rounded-2xl px-3 py-3 transition lg:min-w-0 ${
                      on
                        ? "bg-gradient-to-br from-moss to-moss-dark text-white shadow-[0_8px_20px_rgba(15,110,86,0.28)]"
                        : "text-ink hover:bg-paper"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        on ? "bg-white/15" : "bg-paper ring-1 ring-line"
                      }`}
                    >
                      <Icon className={on ? "text-white" : "text-moss"} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className={`mt-0.5 block text-xs leading-4 ${on ? "text-white/80" : "text-muted"}`}>
                        {item.hint}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          ) : (
            <nav className="mt-3 hidden flex-col items-center gap-2 px-2 pb-4 lg:flex">
              {items.map((item) => {
                const on = item.id === active;
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    title={item.label}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                      on ? "bg-moss text-white shadow-[0_6px_16px_rgba(15,110,86,0.28)]" : "text-ink hover:bg-paper"
                    }`}
                  >
                    <Icon />
                  </Link>
                );
              })}
            </nav>
          )}
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-paper/40">{children}</div>
      </div>
    </TopBar>
  );
}

function AutoPostIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3.2" y="5.2" width="8.2" height="10.2" rx="1.6" opacity="0.45" />
      <rect x="5.4" y="3.6" width="8.2" height="10.2" rx="1.6" />
      <path strokeLinecap="round" d="M7.6 7.4h3.8M7.6 10h2.6" />
      <path
        strokeLinejoin="round"
        strokeLinecap="round"
        d="M13.2 11.2h3.4l-1.35 1.35M16.6 11.2l-1.35-1.35"
      />
    </svg>
  );
}

function SidebarIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      {open ? (
        <>
          <path strokeLinecap="round" d="M4.5 6.5h11M4.5 10h11M4.5 13.5h11" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.2 6.8 11.5 10l2.7 3.2" />
        </>
      ) : (
        <>
          <rect x="3.5" y="4" width="13" height="12" rx="2.2" />
          <path strokeLinecap="round" d="M8 4v12" />
          <path fill="currentColor" stroke="none" d="M4.2 5.2h3.2v9.6H4.2z" opacity="0.35" />
        </>
      )}
    </svg>
  );
}

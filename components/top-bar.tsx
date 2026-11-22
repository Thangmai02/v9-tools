import type { ReactNode } from "react";
import Link from "next/link";
import { AccountChip } from "@/components/account-chip";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { shellClass } from "@/components/ui";

export function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/v9-tools-logo.png"
        alt=""
        className="h-8 w-8 rounded-lg object-cover shadow-[0_1px_2px_rgba(15,110,86,0.35)]"
      />
      <span className="text-[15px] font-semibold tracking-tight text-ink">V9 Tools</span>
    </span>
  );
}

export function TopBar({
  email,
  name,
  avatarUrl,
  pro = false,
  admin = false,
  trailing,
  adminNav = false,
  children,
}: {
  email?: string;
  name?: string;
  avatarUrl?: string | null;
  pro?: boolean;
  admin?: boolean;
  trailing?: ReactNode;
  adminNav?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-paper">
      <header className="z-30 shrink-0 border-b border-line/70 bg-card/45 backdrop-blur-xl">
        <div className={`${shellClass} flex h-16 items-center gap-3`}>
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <Link
              href="/"
              className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-pine/30"
            >
              <BrandMark />
            </Link>
            <AppNav admin={adminNav} />
          </div>
          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Thông báo"
              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-pine/30 hover:bg-paper"
            >
              <BellIcon />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-moss" />
            </button>
            {trailing}
            {name || email ? (
              <AccountChip
                name={name ?? ""}
                email={email ?? ""}
                avatarUrl={avatarUrl}
                pro={pro}
                admin={admin}
              />
            ) : (
              <LogoutButton />
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
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

import type { ReactNode } from "react";
import Link from "next/link";
import { AccessNotices } from "@/components/access-notices";
import { AccountChip } from "@/components/account-chip";
import { WelcomeNotice } from "@/components/welcome-notice";
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
            <AccessNotices />
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
      <WelcomeNotice name={name} admin={admin} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}


import Link from "next/link";
import { BrandMark } from "@/components/top-bar";
import { AccountChip } from "@/components/account-chip";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { shellClass } from "@/components/ui";
import { userHasAdminRole } from "@/lib/admin";
import { memberHasPro } from "@/lib/auth";
import { readSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function SiteHeader() {
  const session = await readSession();
  let email: string | null = null;
  let name: string | null = null;
  let avatarUrl: string | null = null;
  let pro = false;
  let admin = false;
  if (session?.role === "member") {
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, email: true, name: true, plan: true, role: true, avatarUrl: true },
    });
    email = user?.email ?? null;
    name = user?.name ?? null;
    avatarUrl = user?.avatarUrl ?? null;
    pro = user ? await memberHasPro(user.id, user.plan) : false;
    admin = userHasAdminRole(user);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-card/45 backdrop-blur-xl">
      <div className={`${shellClass} flex h-16 items-center gap-3`}>
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link
            href="/"
            className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-pine/30"
          >
            <BrandMark />
          </Link>
          <AppNav admin={admin || session?.role === "admin"} />
        </div>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          {email ? (
            <AccountChip
              name={name ?? ""}
              email={email}
              avatarUrl={avatarUrl}
              pro={pro}
              admin={admin}
            />
          ) : session?.role === "admin" ? (
            <LogoutButton />
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-lg bg-moss px-3 text-sm font-semibold text-white hover:bg-moss-dark"
            >
              Đăng nhập
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

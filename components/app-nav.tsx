"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/",
    label: "Trang chủ",
    match: (path: string) => path === "/",
    icon: HomeIcon,
  },
  {
    href: "/tool",
    label: "Tools",
    match: (path: string) => path === "/tool" || path.startsWith("/tool/") || path.startsWith("/batches/"),
    icon: ToolsIcon,
  },
  {
    href: "/admin",
    label: "Admin",
    match: (path: string) => path === "/admin" || path.startsWith("/admin/"),
    adminOnly: true,
    icon: AdminIcon,
  },
] as const;

export function AppNav({ admin = false }: { admin?: boolean }) {
  const path = usePathname() || "/";

  return (
    <nav className="flex items-center gap-1">
      {items
        .filter((item) => !("adminOnly" in item && item.adminOnly) || admin)
        .map((item) => {
          const on = item.match(path);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm transition ${
                on
                  ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-line"
                  : "font-semibold text-ink/80 hover:bg-surface/80 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinejoin="round" d="M3.5 9.2 10 3.8l6.5 5.4V16a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V9.2Z" />
      <path d="M8 17v-4.5h4V17" />
    </svg>
  );
}

function ToolsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1.2" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1.2" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1.2" />
    </svg>
  );
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="10" cy="7" r="3" />
      <path strokeLinejoin="round" d="M4.5 16.2c1.4-2.2 3.3-3.2 5.5-3.2s4.1 1 5.5 3.2" />
    </svg>
  );
}

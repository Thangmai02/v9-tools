"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function AccountChip({
  name,
  email,
  avatarUrl,
  pro = false,
  admin = false,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  pro?: boolean;
  admin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const onAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const label = name.trim() || email;
  const initial = Array.from(label)[0]?.toLocaleUpperCase("vi") ?? "?";

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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const showPro = pro && !admin;
  const borderTone = admin ? "admin" : showPro ? "pro" : null;

  const chipButton = (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      aria-controls={menuId}
      onClick={() => setOpen((value) => !value)}
      className={`chip-border-face inline-flex h-10 max-w-[16rem] items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-2.5 shadow-[0_1px_2px_rgba(27,25,20,0.04)] transition ${
        borderTone
          ? "border-0 hover:bg-paper"
          : "border border-line hover:border-pine/30"
      }`}
    >
      <AvatarFace src={avatarUrl} initial={initial} size="sm" tone={borderTone} />
      <span className="min-w-0 truncate text-sm font-semibold text-ink">{label}</span>
      <svg
        viewBox="0 0 20 20"
        className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M5 7.5 10 12.5 15 7.5" />
      </svg>
    </button>
  );

  return (
    <div ref={rootRef} className="relative min-w-0">
      {borderTone ? (
        <span className="chip-border-run" data-tone={borderTone}>
          {chipButton}
        </span>
      ) : (
        chipButton
      )}
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-40 mt-2 w-96 rounded-2xl border border-line bg-surface p-4 shadow-[0_10px_28px_rgba(27,25,20,0.12)]"
        >
          <ProfileFrame admin={admin} pro={showPro}>
            <div className="flex items-center gap-3.5 rounded-[11px] bg-paper/90 px-4 py-4">
              <AvatarFace src={avatarUrl} initial={initial} size="lg" tone={borderTone} />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 text-lg font-semibold leading-snug text-ink">
                  <span className="truncate">{label}</span>
                  {admin ? <AdminNeonBadge className="h-5 w-5 shrink-0" /> : null}
                  {showPro ? <ProNeonBadge className="shrink-0" /> : null}
                </p>
                {email ? <p className="mt-1.5 truncate text-[15px] leading-snug text-muted">{email}</p> : null}
              </div>
            </div>
          </ProfileFrame>
          {admin ? (
            <Link
              href={onAdmin ? "/tool" : "/admin"}
              role="menuitem"
              className="mt-3 flex w-full items-center rounded-xl border border-line/80 bg-paper px-4 py-3.5 text-left text-[15px] font-medium text-ink transition hover:border-pine/30 hover:bg-pine/5"
              onClick={() => setOpen(false)}
            >
              {onAdmin ? "Quay về user" : "Admin control"}
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={`${admin ? "mt-2" : "mt-3"} flex w-full items-center rounded-xl border border-line/80 bg-paper px-4 py-3.5 text-left text-[15px] font-medium text-ink transition hover:border-danger/30 hover:bg-danger/5 hover:text-danger`}
            onClick={logout}
          >
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProfileFrame({
  admin,
  pro,
  children,
}: {
  admin?: boolean;
  pro?: boolean;
  children: ReactNode;
}) {
  if (!admin && !pro) return children;

  const background = admin && pro
    ? "linear-gradient(120deg, #22d3ee, #a3e635, #fbbf24, #a78bfa, #f472b6, #38bdf8)"
    : admin
      ? "linear-gradient(120deg, #22d3ee, #a3e635, #fbbf24, #22d3ee)"
      : "linear-gradient(120deg, #38bdf8, #a78bfa, #f472b6, #22d3ee, #818cf8)";

  const boxShadow = admin && pro
    ? "0 0 10px rgba(34,211,238,0.55), 0 0 16px rgba(167,139,250,0.4), 0 0 12px rgba(251,191,36,0.35)"
    : admin
      ? "0 0 10px rgba(34,211,238,0.7), 0 0 14px rgba(163,230,53,0.45), 0 0 10px rgba(251,191,36,0.4)"
      : "0 0 10px rgba(99,102,241,0.55), 0 0 16px rgba(236,72,153,0.35), 0 0 12px rgba(56,189,248,0.4)";

  return (
    <div className="rounded-xl p-px" style={{ background, boxShadow }}>
      {children}
    </div>
  );
}

function AvatarFace({
  src,
  initial,
  size,
  tone = null,
}: {
  src?: string | null;
  initial: string;
  size: "sm" | "lg";
  tone?: "admin" | "pro" | "both" | null;
}) {
  const box = size === "lg" ? "h-14 w-14 text-xl" : "h-8 w-8 text-sm";
  const face = (
    <span className={`avatar-border-face relative block ${box}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-moss font-semibold text-white">
          {initial}
        </span>
      )}
    </span>
  );

  if (!tone) {
    return (
      <span className={`relative shrink-0 ${box} ${size === "lg" ? "ring-1 ring-line rounded-full" : ""}`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-moss font-semibold text-white">
            {initial}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className="avatar-border-run shrink-0"
      data-tone={tone}
      style={{
        boxShadow:
          tone === "pro"
            ? "0 0 8px rgba(167,139,250,0.45)"
            : tone === "both"
              ? "0 0 8px rgba(34,211,238,0.4), 0 0 10px rgba(167,139,250,0.35)"
              : "0 0 8px rgba(34,211,238,0.5)",
      }}
    >
      {face}
    </span>
  );
}

/** Khiên neon admin: cyan / lime / amber */
function AdminNeonBadge({ className = "" }: { className?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        filter:
          "drop-shadow(0 0 4px rgba(34,211,238,0.9)) drop-shadow(0 0 7px rgba(163,230,53,0.55)) drop-shadow(0 0 6px rgba(251,191,36,0.45))",
      }}
      title="Admin"
      aria-label="Admin"
    >
      <svg viewBox="0 0 16 16" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#a3e635" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${gid})`}
          d="M8 1.2 13.4 3.3v3.6c0 3.5-2.3 6.2-5.4 7.5C4.9 13.1 2.6 10.4 2.6 6.9V3.3L8 1.2Z"
        />
        <path
          fill="#0b1220"
          d="M8 2.5 12.2 4.1v2.8c0 2.7-1.7 4.8-4.2 5.8C5.5 11.7 3.8 9.6 3.8 6.9V4.1L8 2.5Z"
        />
        <path
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.7 7.7 7.3 9.3 10.5 5.9"
        />
      </svg>
    </span>
  );
}

/** Pro capsule: chữ nhỏ, viền galaxy phát sáng */
export function ProNeonBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex rounded-full p-px ${className}`}
      style={{
        background: "linear-gradient(120deg, #38bdf8, #a78bfa, #f472b6, #22d3ee, #818cf8)",
        boxShadow:
          "0 0 8px rgba(99,102,241,0.65), 0 0 14px rgba(236,72,153,0.4), 0 0 10px rgba(56,189,248,0.45)",
      }}
      title="Pro"
      aria-label="Pro"
    >
      <span
        className="inline-flex h-[16px] items-center rounded-full px-2"
        style={{
          background:
            "linear-gradient(135deg, #0b1026 0%, #1a1040 40%, #0c1b3a 70%, #12082a 100%)",
        }}
      >
        <span
          className="text-[9px] font-bold uppercase leading-none tracking-[0.14em]"
          style={{
            background: "linear-gradient(90deg, #7dd3fc, #e9d5ff, #f9a8d4, #67e8f9)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          pro
        </span>
      </span>
    </span>
  );
}

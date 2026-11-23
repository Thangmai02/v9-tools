"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClass, ErrorNote, fieldClass, labelClass, linkClass } from "@/components/ui";

export function AuthShell({
  title,
  hint,
  children,
  footer,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="auth-stage relative z-[1] flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-5">
        <ThemeToggle />
      </div>

      <div className="auth-sky" aria-hidden>
        <span className="auth-haze auth-haze-a" />
        <span className="auth-haze auth-haze-b" />
        <span className="auth-horizon" />
        <span className="auth-sun" />
        <span className="auth-sun-ray auth-sun-ray-a" />
        <span className="auth-sun-ray auth-sun-ray-b" />
        <span className="auth-sun-ray auth-sun-ray-c" />
        <span className="auth-cloud auth-cloud-a" />
        <span className="auth-cloud auth-cloud-b" />
        <span className="auth-cloud auth-cloud-c" />
        <span className="auth-moon">
          <span className="auth-moon-crater auth-moon-crater-a" />
          <span className="auth-moon-crater auth-moon-crater-b" />
          <span className="auth-moon-crater auth-moon-crater-c" />
        </span>
        <span className="auth-stars" />
        <span className="auth-stars auth-stars-mid" />
        <span className="auth-stars auth-stars-far" />
        <span className="auth-shoot auth-shoot-a" />
        <span className="auth-shoot auth-shoot-b" />
        <span className="auth-sparkle auth-sparkle-a" />
        <span className="auth-sparkle auth-sparkle-b" />
        <span className="auth-sparkle auth-sparkle-c" />
      </div>

      <section className="auth-card relative z-10 w-full max-w-[26rem] p-6 text-center sm:p-8">
        <span className="auth-card-sheen" aria-hidden />
        <div className="relative flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/v9-tools-logo.png"
            alt=""
            className="auth-logo h-14 w-14 rounded-2xl object-cover"
          />
          <div className="min-w-0">
            <p className="auth-brand text-[1.85rem] font-semibold leading-none tracking-[-0.04em] text-ink">
              V9 Tools
            </p>
            <p className="auth-byline mt-2.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              MAI VĂN THĂNG
            </p>
          </div>
        </div>

        <h1 className="relative mt-7 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        <p className="relative mx-auto mt-2 max-w-[20rem] text-sm leading-6 text-muted">
          {hint}
        </p>

        <div className="relative mt-6 text-left">{children}</div>

        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-line/70 pt-4 text-sm leading-6 text-muted">
          {footer}
        </div>
      </section>
    </main>
  );
}

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      setError("Phiên đăng nhập cũ không còn. Hãy đăng nhập lại.");
    }
    const reason = params.get("google");
    if (!reason) return;
    const messages: Record<string, string> = {
      missing: "Chưa cấu hình Google Client ID/Secret trên server.",
      denied: "Bạn đã hủy đăng nhập Google.",
      invalid: "Phiên Google không hợp lệ. Thử lại.",
      failed: "Không đăng nhập được bằng Gmail.",
    };
    if (messages[reason]) setError(messages[reason]);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Không đăng nhập được.");
      setPending(false);
      return;
    }
    window.location.href = "/tool?welcome=1";
  }

  return (
    <AuthShell
      title="Đăng nhập"
      hint="Đăng nhập để mở khóa nhiều tính năng hơn."
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link href="/register" className={linkClass}>
            Tạo tài khoản
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className={labelClass}>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        <label className={labelClass}>
          Mật khẩu
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button className={`${buttonClass} w-full`} disabled={pending}>
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      <div className="mt-4">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          hoặc
          <span className="h-px flex-1 bg-line" />
        </div>
        <a
          href="/api/auth/google/start"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-ink transition hover:border-pine/30 hover:bg-paper"
        >
          <GoogleMark />
          Đăng nhập bằng Gmail
        </a>
      </div>
    </AuthShell>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12Z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3 5.8 14.9l-2.6 2C4.7 19.7 8.1 22 12 22c2.7 0 5-.9 6.6-2.4l-3.1-2.4c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3Z"
      />
      <path
        fill="#4A90E2"
        d="M3.2 7.1C2.4 8.6 2 10.2 2 12s.4 3.4 1.2 4.9l3.4-2.6C6.2 13.5 6 12.8 6 12s.2-1.5.6-2.3L3.2 7.1Z"
      />
      <path
        fill="#FBBC05"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.1 14.7 2 12 2 8.1 2 4.7 4.3 3.2 7.1l3.4 2.6C7 7.8 9.3 6 12 6Z"
      />
    </svg>
  );
}

export function RegisterForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      setPending(false);
      return;
    }
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Không tạo được tài khoản.");
      setPending(false);
      return;
    }
    window.location.href = "/tool";
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      hint="Tạo tài khoản nhân viên. Mã khóa Facebook do admin gắn ở trang quản trị."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link href="/login" className={linkClass}>
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className={labelClass}>
          Tên
          <input
            name="name"
            required
            autoComplete="name"
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        <label className={labelClass}>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        <label className={labelClass}>
          Mật khẩu
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        <label className={labelClass}>
          Xác nhận mật khẩu
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={`${fieldClass} mt-1.5`}
          />
        </label>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <button className={`${buttonClass} w-full`} disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo tài khoản"}
        </button>
      </form>
      <div className="mt-4">
        <div className="mb-3 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          hoặc
          <span className="h-px flex-1 bg-line" />
        </div>
        <a
          href="/api/auth/google/start"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-ink transition hover:border-pine/30 hover:bg-paper"
        >
          <GoogleMark />
          Đăng nhập bằng Gmail
        </a>
      </div>
    </AuthShell>
  );
}

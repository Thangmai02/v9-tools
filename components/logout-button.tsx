"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="inline-flex h-9 shrink-0 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(27,25,20,0.04)] transition hover:border-pine/40 hover:bg-paper"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      }}
    >
      Thoát
    </button>
  );
}

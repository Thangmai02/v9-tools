"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Đổi sang giao diện sáng" : "Đổi sang giao diện tối"}
      title={dark ? "Giao diện sáng" : "Giao diện tối"}
      onClick={toggle}
      className="relative h-8 w-[4.25rem] shrink-0 rounded-full bg-line shadow-[inset_0_1px_2px_rgba(28,32,44,0.14),0_1px_2px_rgba(28,32,44,0.12)]"
    >
      <span
        className={`absolute top-0.5 h-7 w-9 rounded-full bg-surface shadow-[0_2px_6px_rgba(20,24,40,0.18)] transition-all ${
          dark ? "left-[calc(100%-2.375rem)]" : "left-0.5"
        }`}
      />
      <span className="relative z-10 grid h-full grid-cols-2 place-items-center text-ink">
        <SunIcon />
        <MoonIcon />
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="3.6" />
      <path strokeLinecap="round" d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinejoin="round" d="M16.2 14.2A6.2 6.2 0 0 1 9.6 4.4 6.4 6.4 0 1 0 16.2 14.2Z" />
    </svg>
  );
}

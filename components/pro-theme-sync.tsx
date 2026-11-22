"use client";

import { useEffect } from "react";

/** Đồng bộ class pro-neon trên <html> sau điều hướng client. */
export function ProThemeSync() {
  useEffect(() => {
    let ignore = false;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (ignore) return;
        const on = Boolean(data?.user?.pro);
        document.documentElement.classList.toggle("pro-neon", on);
        if (on) document.documentElement.dataset.pro = "true";
        else delete document.documentElement.dataset.pro;
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  return null;
}

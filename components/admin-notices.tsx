"use client";

import { FormEvent, useEffect, useState } from "react";
import { buttonClass, cardClass, ErrorNote, fieldClass, areaClass, formatWhen, labelClass } from "@/components/ui";

type Person = { id: string; name: string; email: string };

type Sent = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  recipients: number;
};

export function AdminNotices({ users }: { users: Person[] }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/announcements")
      .then(async (response) => {
        const data = await response.json();
        if (ignore || !response.ok) return;
        setSent(data.announcements ?? []);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    const response = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: message,
        all,
        userIds: all ? [] : picked,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Không gửi được.");
      setBusy(false);
      return;
    }
    setSent((current) => [
      {
        id: data.id,
        title: title.trim(),
        body: message.trim(),
        createdAt: new Date().toISOString(),
        recipients: data.recipients,
      },
      ...current,
    ]);
    setTitle("");
    setMessage("");
    setPicked([]);
    setStatus(`Đã gửi tới ${data.recipients} tài khoản.`);
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Gửi thông báo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Ai đang mở tool sẽ thấy thông báo khoảng 3 giây, rồi nội dung nằm trong chuông. Ai không có mặt chỉ thấy một lần khi quay lại.
        </p>
      </div>
      <form onSubmit={onSubmit} className={`${cardClass} space-y-4 p-5`}>
        <label className={labelClass}>
          Tiêu đề
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            className={`${fieldClass} mt-1.5`}
            placeholder="Ví dụ: Bảo trì tối nay"
          />
        </label>
        <label className={labelClass}>
          Nội dung
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={2000}
            required
            rows={4}
            className={`${areaClass} mt-1.5`}
            placeholder="Nội dung user sẽ đọc"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={all}
            onChange={(event) => setAll(event.target.checked)}
            className="h-4 w-4"
          />
          Gửi tất cả tài khoản ({users.length})
        </label>
        {all ? null : (
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-line p-3">
            {users.length === 0 ? (
              <li className="text-sm text-muted">Chưa có tài khoản.</li>
            ) : (
              users.map((user) => (
                <li key={user.id}>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={picked.includes(user.id)}
                      onChange={() => toggle(user.id)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium">{user.name}</span>
                    <span className="truncate text-muted">{user.email}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        )}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {status ? <p className="text-sm text-ink">{status}</p> : null}
        <button className={buttonClass} disabled={busy || users.length === 0}>
          {busy ? "Đang gửi..." : "Gửi thông báo"}
        </button>
      </form>
      <section className={`${cardClass} overflow-hidden`}>
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">Đã gửi</h2>
        {sent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Chưa gửi thông báo nào.</p>
        ) : (
          <ul>
            {sent.map((item) => (
              <li key={item.id} className="border-b border-line px-5 py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="shrink-0 text-xs text-muted">{formatWhen(item.createdAt)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted">{item.body}</p>
                <p className="mt-1 text-xs text-muted">{item.recipients} tài khoản</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { buttonClass, cardClass, ErrorNote, fieldClass, areaClass, formatWhen, labelClass } from "@/components/ui";

type Person = { id: string; name: string; email: string };

type Audience = "all" | "one" | "group";

type Sent = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  recipients: number;
  audience: Audience;
  names: string[];
};

const audiences: { id: Audience; label: string }[] = [
  { id: "one", label: "Một user" },
  { id: "group", label: "Nhóm user" },
  { id: "all", label: "Tất cả user" },
];

function audienceLabel(item: Pick<Sent, "audience" | "recipients" | "names">) {
  if (item.audience === "all") return `Tất cả · ${item.recipients} tài khoản`;
  if (item.audience === "one") return item.names[0] || "1 tài khoản";
  const shown = item.names.slice(0, 3).join(", ");
  const extra = item.recipients - Math.min(item.names.length, 3);
  return extra > 0 ? `Nhóm · ${shown} và ${extra} người nữa` : `Nhóm · ${shown}`;
}

export function AdminNotices({ users }: { users: Person[] }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("one");
  const [oneId, setOneId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
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
    const userIds = audience === "one" ? (oneId ? [oneId] : []) : audience === "group" ? picked : [];
    if (audience === "one" && userIds.length !== 1) {
      setError("Chọn một user.");
      setBusy(false);
      return;
    }
    if (audience === "group" && userIds.length < 2) {
      setError("Nhóm cần ít nhất hai user.");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: message,
        audience,
        userIds,
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
        audience,
        names:
          audience === "one"
            ? users.filter((user) => user.id === oneId).map((user) => user.name)
            : users.filter((user) => picked.includes(user.id)).map((user) => user.name),
      },
      ...current,
    ]);
    setTitle("");
    setMessage("");
    setPicked([]);
    setOneId("");
    setStatus(
      audience === "all"
        ? `Đã gửi tới tất cả ${data.recipients} tài khoản.`
        : audience === "one"
          ? "Đã gửi cho 1 user."
          : `Đã gửi cho nhóm ${data.recipients} user.`,
    );
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
        <div>
          <p className={labelClass}>Người nhận</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Người nhận">
            {audiences.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={audience === item.id}
                onClick={() => setAudience(item.id)}
                className={`h-10 rounded-full px-4 text-sm font-semibold ${
                  audience === item.id ? "bg-moss text-white" : "border border-line bg-surface text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {audience === "all" ? (
          <p className="text-sm text-muted">Gửi một lần cho {users.length} tài khoản.</p>
        ) : null}
        {audience === "one" ? (
          <label className={labelClass}>
            Chọn user
            <select
              value={oneId}
              onChange={(event) => setOneId(event.target.value)}
              required
              className={`${fieldClass} mt-1.5`}
            >
              <option value="">Chọn một tài khoản</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {audience === "group" ? (
          <div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={fieldClass}
              placeholder="Tìm user trong nhóm..."
            />
            <p className="mt-2 text-xs text-muted">Đã chọn {picked.length} user. Nhóm cần ít nhất 2 người.</p>
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-line p-3">
              {users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase())).length === 0 ? (
                <li className="text-sm text-muted">Không thấy user.</li>
              ) : (
                users
                  .filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()))
                  .map((user) => (
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
          </div>
        ) : null}
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
                <p className="mt-1 text-xs text-muted">{audienceLabel(item)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

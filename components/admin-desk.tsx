"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ProNeonBadge } from "@/components/account-chip";
import { AdminNotices } from "@/components/admin-notices";
import { AuthShell } from "@/components/auth-card";
import { TopBar } from "@/components/top-bar";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  ErrorNote,
  fieldClass,
  formatWhen,
  quietButtonClass,
  labelClass,
  linkClass,
  StatusBadge,
} from "@/components/ui";

function PlanMark({ plan }: { plan: string }) {
  if (plan === "pro") return <ProNeonBadge />;
  return <StatusBadge status={plan} />;
}

type FbKey = {
  id: string;
  label: string;
  color: string;
  name: string | null;
  pageCount: number;
  userCount?: number;
  hint?: string;
  createdAt?: string;
};

type Member = {
  id: string;
  name: string;
  email: string;
  plan: string;
  createdAt: string;
  licenseKey: string | null;
  facebookKeyId: string | null;
  facebookKey: { id: string; label: string; color: string } | null;
};

function PlanButton({
  user,
  busy,
  onChange,
  block,
}: {
  user: Member;
  busy: boolean;
  onChange: (action: "upgrade" | "downgrade") => void;
  block?: boolean;
}) {
  const width = block ? "w-full" : "";
  if (user.plan === "pro" && user.licenseKey) {
    return (
      <button
        type="button"
        className={`${dangerButtonClass} ${width}`}
        disabled={busy}
        onClick={() => onChange("downgrade")}
      >
        Hạ Pro
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`${buttonClass} ${width}`}
      disabled={busy}
      onClick={() => onChange("upgrade")}
    >
      Nâng Pro
    </button>
  );
}

export function AdminLogin() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Không vào được.");
      setPending(false);
      return;
    }
    window.location.href = "/admin?welcome=1";
  }

  return (
    <AuthShell
      title="Cửa admin"
      hint="Mật khẩu nằm trong file cấu hình của server."
      footer={
        <Link href="/login" className={linkClass}>
          Về đăng nhập thành viên
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className={labelClass}>
          Mật khẩu admin
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
          {pending ? "Đang vào..." : "Vào admin"}
        </button>
      </form>
    </AuthShell>
  );
}

function FacebookKeyCard({ onKeysChange }: { onKeysChange?: (keys: FbKey[]) => void }) {
  const [keys, setKeys] = useState<FbKey[]>([]);
  const [colors, setColors] = useState<string[]>(["#0f6e56"]);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#0f6e56");
  const [token, setToken] = useState("");
  const [reveal, setReveal] = useState(false);
  const [openTokens, setOpenTokens] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");

  async function loadKeys() {
    const response = await fetch("/api/admin/facebook-keys");
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Không tải được danh sách mã.");
      return;
    }
    const next = (data.keys ?? []) as FbKey[];
    setKeys(next);
    setColors(data.colors?.length ? data.colors : ["#0f6e56"]);
    onKeysChange?.(next);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/facebook-keys")
      .then(async (response) => {
        const data = await response.json();
        if (ignore || !response.ok) return;
        const next = (data.keys ?? []) as FbKey[];
        setKeys(next);
        setColors(data.colors?.length ? data.colors : ["#0f6e56"]);
        onKeysChange?.(next);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
    // Chỉ tải lần đầu; sau thêm/xóa sẽ gọi loadKeys().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setStatus("");
    const response = await fetch("/api/admin/facebook-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color, token }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Không thêm được mã.");
      setBusy("");
      return;
    }
    setLabel("");
    setToken("");
    await loadKeys();
    setStatus("Đã thêm mã và tải Page.");
    setBusy("");
  }

  async function removeKey(id: string) {
    if (!window.confirm("Xóa mã này và Page gắn với mã?")) return;
    setBusy(id);
    setStatus("");
    const response = await fetch(`/api/admin/facebook-keys/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) setStatus(data.error || "Không xóa được mã.");
    else {
      await loadKeys();
      setStatus("Đã xóa mã.");
    }
    setBusy("");
  }

  async function copyToken(id: string) {
    const response = await fetch(`/api/admin/facebook-keys/${id}/token`);
    const data = await response.json();
    if (!response.ok || !data.token) {
      setStatus(data.error || "Không chép được token.");
      return;
    }
    await navigator.clipboard.writeText(data.token);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? "" : current)), 1500);
  }

  return (
    <section className={`${cardClass} p-5 sm:p-6`}>
      <h2 className="text-lg font-semibold text-ink">Danh sách mã khóa Facebook</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        Thêm mã, gán màu, rồi chọn mã cho từng tài khoản bên dưới.
      </p>

      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-paper/80 text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Tên mã</th>
                <th className="px-3 py-2.5 font-medium">Facebook</th>
                <th className="px-3 py-2.5 font-medium">Page / TK</th>
                <th className="px-3 py-2.5 font-medium">Token</th>
                <th className="px-3 py-2.5 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-muted">
                    Chưa có mã. Thêm mã bên dưới.
                  </td>
                </tr>
              ) : (
                keys.map((key) => {
                  const shown = openTokens[key.id];
                  return (
                    <tr key={key.id} className="border-t border-line align-middle">
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-2 font-medium text-ink">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: key.color }} />
                          {key.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted">{key.name || "—"}</td>
                      <td className="px-3 py-2.5 text-ink">
                        {key.pageCount} Page · {key.userCount ?? 0} TK
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-muted">
                            {shown ? key.hint || "—" : "••••••••••••"}
                          </span>
                          <button
                            type="button"
                            aria-label={shown ? "Ẩn token" : "Hiện token"}
                            title={shown ? "Ẩn" : "Hiện"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:border-pine/40 hover:bg-paper"
                            onClick={() =>
                              setOpenTokens((current) => ({ ...current, [key.id]: !current[key.id] }))
                            }
                          >
                            {shown ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                          <button
                            type="button"
                            aria-label={copiedId === key.id ? "Đã chép" : "Chép token"}
                            title={copiedId === key.id ? "Đã chép" : "Chép"}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:border-pine/40 hover:bg-paper"
                            onClick={() => copyToken(key.id)}
                          >
                            {copiedId === key.id ? <CheckIcon /> : <CopyIcon />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          aria-label="Xóa mã"
                          title="Xóa"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-danger/30 bg-surface text-danger transition hover:bg-danger/5 disabled:opacity-50"
                          disabled={busy !== ""}
                          onClick={() => removeKey(key.id)}
                        >
                          {busy === key.id ? (
                            <span className="text-xs">…</span>
                          ) : (
                            <TrashIcon />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={addKey} className="mt-4 space-y-3 border-t border-line pt-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className={labelClass}>
            Tên mã
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className={`${fieldClass} mt-1.5`}
              placeholder="VD: Shop A"
            />
          </label>
          <div>
            <p className={labelClass}>Màu</p>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1.5">
              {colors.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`Chọn màu ${item}`}
                  aria-pressed={color === item}
                  onClick={() => setColor(item)}
                  className={`h-5 w-5 rounded-full transition ${
                    color === item ? "ring-2 ring-ink ring-offset-1 ring-offset-paper" : "opacity-70 hover:opacity-100"
                  }`}
                  style={{ background: item }}
                />
              ))}
            </div>
          </div>
        </div>
        <label className={labelClass}>
          Token
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="admin-token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="Dán user access token"
              className={fieldClass}
            />
            <div className="flex gap-2">
              <button type="button" className={quietButtonClass} onClick={() => setReveal((value) => !value)}>
                {reveal ? "Ẩn" : "Hiện"}
              </button>
              <button type="submit" className={buttonClass} disabled={busy !== "" || token.trim().length < 20}>
                {busy === "save" ? "..." : "Thêm mã"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            Auto lên camp cần token có quyền <span className="font-medium text-ink">ads_management</span> và Ad
            Account trên tài khoản đó.
          </p>
        </label>
      </form>
      {status ? <p className="mt-3 text-sm text-ink">{status}</p> : null}
    </section>
  );
}

export function AdminDesk({
  actor = null,
}: {
  actor?: { name: string; email: string; avatarUrl?: string | null; pro?: boolean } | null;
} = {}) {
  const [users, setUsers] = useState<Member[]>([]);
  const [fbKeys, setFbKeys] = useState<FbKey[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"accounts" | "notices">("accounts");

  async function load() {
    const response = await fetch("/api/admin/users");
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Không tải được danh sách.");
      return;
    }
    setUsers(data.users);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/users")
      .then(async (response) => {
        const data = await response.json();
        if (ignore) return;
        if (!response.ok) setError(data.error || "Không tải được danh sách.");
        else setUsers(data.users);
      })
      .catch(() => {
        if (!ignore) setError("Không tải được danh sách.");
      })
      .finally(() => {
        if (!ignore) setReady(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function changePlan(id: string, action: "upgrade" | "downgrade") {
    setBusyId(id);
    setError("");
    const response = await fetch(`/api/admin/users/${id}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Không đổi được gói.");
    else await load();
    setBusyId("");
  }

  async function changeFacebookKey(id: string, facebookKeyId: string) {
    setBusyId(`key-${id}`);
    setError("");
    const response = await fetch(`/api/admin/users/${id}/facebook-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facebookKeyId: facebookKeyId || null }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Không gán được mã.");
    else await load();
    setBusyId("");
  }

  function KeySelect({ user }: { user: Member }) {
    const selected = fbKeys.find((key) => key.id === user.facebookKeyId) ?? user.facebookKey;
    return (
      <label className="relative block min-w-[12rem]">
        <span className="sr-only">Mã Facebook</span>
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{ background: selected?.color || "#9ca3af" }}
        />
        <select
          className={`${fieldClass} py-2 pl-7 text-sm`}
          value={user.facebookKeyId ?? ""}
          disabled={busyId === `key-${user.id}`}
          onChange={(event) => changeFacebookKey(user.id, event.target.value)}
          style={
            selected
              ? { borderColor: `${selected.color}66`, background: `${selected.color}14` }
              : undefined
          }
        >
          <option value="">Chưa gán mã</option>
          {fbKeys.map((key) => (
            <option key={key.id} value={key.id}>
              {key.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <TopBar
      adminNav={!actor}
      email={actor?.email}
      name={actor?.name}
      avatarUrl={actor?.avatarUrl}
      pro={Boolean(actor?.pro)}
      admin
      trailing={
        <span className="inline-flex h-9 items-center rounded-full bg-pine/10 px-3 text-sm font-semibold text-pine">
          Admin
        </span>
      }
    >
      <main className="h-full w-full space-y-8 overflow-y-auto px-4 py-8 sm:px-5 sm:py-10 lg:px-6 xl:px-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={tab === "accounts"}
            onClick={() => setTab("accounts")}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              tab === "accounts" ? "bg-moss text-white" : "border border-line bg-surface text-ink"
            }`}
          >
            Tài khoản
          </button>
          <button
            type="button"
            aria-pressed={tab === "notices"}
            onClick={() => setTab("notices")}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              tab === "notices" ? "bg-moss text-white" : "border border-line bg-surface text-ink"
            }`}
          >
            Gửi thông báo
          </button>
        </div>
        {tab === "notices" ? (
          <AdminNotices users={users.map((user) => ({ id: user.id, name: user.name, email: user.email }))} />
        ) : (
        <>
        <FacebookKeyCard onKeysChange={setFbKeys} />
        <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Tài khoản</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Chọn mã khóa Facebook cho từng tài khoản. Mỗi mã có thẻ màu riêng ở danh sách phía trên.
        </p>
        {error ? (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}

        <div className="mt-6 space-y-3 md:hidden">
          {!ready ? (
            <p className={`${cardClass} px-4 py-8 text-sm text-muted`}>Đang tải...</p>
          ) : users.length === 0 ? (
            <p className={`${cardClass} px-4 py-8 text-sm text-muted`}>Chưa có ai đăng ký.</p>
          ) : (
            users.map((user) => (
              <article key={user.id} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{user.name}</p>
                    <p className="mt-0.5 break-all text-sm text-muted">{user.email}</p>
                  </div>
                  <PlanMark plan={user.plan} />
                </div>
                <p className="mt-3 text-xs text-muted">{formatWhen(user.createdAt)}</p>
                <div className="mt-3">
                  <KeySelect user={user} />
                </div>
                <div className="mt-4">
                  <PlanButton
                    user={user}
                    busy={busyId === user.id}
                    onChange={(action) => changePlan(user.id, action)}
                    block
                  />
                </div>
              </article>
            ))
          )}
        </div>

        <div className={`${cardClass} mt-6 hidden overflow-hidden md:block`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-paper/80 text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Tên</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Ngày tạo</th>
                  <th className="px-4 py-3 font-medium">Gói</th>
                  <th className="px-4 py-3 font-medium">Mã Facebook</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {!ready ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-muted">
                      Đang tải...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-muted">
                      Chưa có ai đăng ký.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-t border-line align-middle hover:bg-paper/50">
                      <td className="px-4 py-3.5 font-medium text-ink">{user.name}</td>
                      <td className="px-4 py-3.5 text-ink">{user.email}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-muted">
                        {formatWhen(user.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <PlanMark plan={user.plan} />
                      </td>
                      <td className="px-4 py-3.5">
                        <KeySelect user={user} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <PlanButton
                          user={user}
                          busy={busyId === user.id}
                          onChange={(action) => changePlan(user.id, action)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        </>
        )}
      </main>
    </TopBar>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M2 10s3.2-5.5 8-5.5S18 10 18 10s-3.2 5.5-8 5.5S2 10 2 10Z" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M3 3.5 16.5 17" strokeLinecap="round" />
      <path d="M8.2 8.3A2.4 2.4 0 0 0 10 12.4a2.4 2.4 0 0 0 2.1-1.2" />
      <path d="M4.3 6.2C3 7.4 2 10 2 10s3.2 5.5 8 5.5c1.3 0 2.5-.3 3.5-.8M15.5 12.8c1.1-1 1.8-2 2.5-2.8 0 0-3.2-5.5-8-5.5-.9 0-1.7.1-2.5.4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M4.5 13V4.5A1.5 1.5 0 0 1 6 3h7.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" d="M4 6h12M8 6V4.5h4V6M7 6l.7 10h4.6L13 6" />
    </svg>
  );
}

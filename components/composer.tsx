"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CoverEditor } from "@/components/cover-editor";
import {
  areaClass,
  buttonClass,
  cardClass,
  ErrorNote,
  fieldClass,
  formatWhen,
  labelClass,
  quietButtonClass,
  StatusBadge,
} from "@/components/ui";

export type ComposerPage = {
  id: string;
  name: string;
  category: string | null;
  pictureUrl: string | null;
};

export type ComposerBatchPage = {
  id: string;
  name: string;
  pictureUrl: string | null;
  status: string;
  error?: string | null;
  fbPostId?: string | null;
  commentStatus?: string | null;
  commentError?: string | null;
  runAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  message?: string | null;
};

export type ComposerBatch = {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  delaySeconds: number;
  pages: ComposerBatchPage[];
  counts: { success: number; failed: number; pending: number; running: number; total: number };
};

export type ComposerDraft = {
  id: string;
  message: string;
  link: string;
  delaySeconds: number;
  commentDelaySeconds: number;
  commentEnabled: boolean;
  commentText: string;
  separateComments: boolean;
  commentImageUrl: string | null;
  comments: { text: string; imageUrl: string | null; storedIndex: number }[];
  pageComments: { pageId: string; comments: { text: string; imageUrl: string | null; storedIndex: number }[] }[];
  scheduledAt: string | null;
  pageIds: string[];
  imageUrl: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
};

type MediaItem = {
  key: string;
  kind: "image" | "video";
  name: string;
  previewUrl: string;
  file: File | null;
  coverBlob: Blob | null;
  coverPreviewUrl: string | null;
  coverTime: number | null;
  caption: string;
  picked: boolean;
  priority: boolean;
  fromDraft: boolean;
};

type CommentPhoto = {
  file: File | null;
  url: string | null;
  cleared: boolean;
};

function photoFromUrl(url: string | null | undefined): CommentPhoto | null {
  if (!url) return null;
  return { file: null, url, cleared: false };
}

function SwitchKnob({ on, compact = false }: { on: boolean; compact?: boolean }) {
  return (
    <span
      className={`relative shrink-0 rounded-full transition ${
        compact ? "mt-0.5 h-4 w-8" : "mt-0.5 h-6 w-11"
      } ${on ? "bg-moss" : "bg-line"}`}
    >
      <span
        className={`absolute rounded-full bg-white transition ${
          compact
            ? `top-0.5 h-3 w-3 ${on ? "left-4" : "left-0.5"}`
            : `top-0.5 h-5 w-5 ${on ? "left-5" : "left-0.5"}`
        }`}
      />
    </span>
  );
}

function CommentPhotoButton({
  photo,
  onPick,
  onClear,
  compact = false,
}: {
  photo: CommentPhoto | null;
  onPick: (file: File) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`relative shrink-0 ${compact ? "h-14 w-14" : "h-24 w-24"}`}>
      <label className="flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-surface text-xs text-muted hover:border-pine/40">
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center leading-4">Thêm ảnh</span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            const name = file.name.toLowerCase();
            if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/.test(name)) return;
            onPick(file);
          }}
        />
      </label>
      {photo?.url ? (
        <button
          type="button"
          aria-label="Bỏ ảnh bình luận"
          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-sm leading-none text-danger"
          onClick={onClear}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

type ChatBox = {
  key: string;
  text: string;
  image: CommentPhoto | null;
  storedIndex: number | null;
};

function emptyBox(): ChatBox {
  return { key: Math.random().toString(36).slice(2), text: "", image: null, storedIndex: null };
}

function boxesFrom(
  rows: { text: string; imageUrl: string | null; storedIndex: number }[] | undefined,
): ChatBox[] {
  if (!rows?.length) return [emptyBox()];
  return rows.map((row) => ({
    key: `saved-${row.storedIndex}-${Math.random().toString(36).slice(2)}`,
    text: row.text,
    image: photoFromUrl(row.imageUrl),
    storedIndex: row.storedIndex,
  }));
}

function isCommentImage(file: File) {
  const name = file.name.toLowerCase();
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name);
}

function resizeBoxes(current: ChatBox[], count: number) {
  const nextCount = Math.max(1, Math.min(100, Math.floor(count) || 1));
  if (nextCount === current.length) return current;
  if (nextCount < current.length) return current.slice(0, nextCount);
  return [...current, ...Array.from({ length: nextCount - current.length }, emptyBox)];
}

function withDroppedImages(current: ChatBox[], files: File[]) {
  const images = files.filter(isCommentImage);
  const rejected = files.some((file) => !isCommentImage(file));
  if (!images.length) return { boxes: current, rejected, overflow: false };
  const queue = images.map((file) => ({ file, url: URL.createObjectURL(file) }));
  const filled = current.map((box) => {
    if (box.image?.url || queue.length === 0) return box;
    const photo = queue.shift()!;
    return { ...box, image: { file: photo.file, url: photo.url, cleared: false } };
  });
  const extras = queue.splice(0).map((photo) => ({
    key: Math.random().toString(36).slice(2),
    text: "",
    image: { file: photo.file, url: photo.url, cleared: false },
    storedIndex: null as number | null,
  }));
  const room = Math.max(0, 100 - filled.length);
  extras.slice(room).forEach((box) => {
    if (box.image.url.startsWith("blob:")) URL.revokeObjectURL(box.image.url);
  });
  return { boxes: [...filled, ...extras.slice(0, room)], rejected, overflow: extras.length > room };
}

function revokeGone(previous: ChatBox[], next: ChatBox[], stillUsed: (url: string) => boolean) {
  const keys = new Set(next.map((box) => box.key));
  for (const box of previous) {
    if (keys.has(box.key)) continue;
    const url = box.image?.url;
    if (!url?.startsWith("blob:")) continue;
    if (next.some((item) => item.image?.url === url) || stillUsed(url)) continue;
    URL.revokeObjectURL(url);
  }
}

function CommentZone({
  boxes,
  onChange,
  onProblem,
  compact = false,
}: {
  boxes: ChatBox[];
  onChange: (next: ChatBox[]) => void;
  onProblem: (message: string) => void;
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);

  function takeFiles(list: FileList | File[]) {
    const result = withDroppedImages(boxes, Array.from(list));
    if (result.overflow) onProblem("Mỗi bài tối đa 100 bình luận.");
    else if (result.rejected) onProblem("Ảnh bình luận chỉ nhận JPG, PNG hoặc WEBP.");
    else onProblem("");
    onChange(result.boxes);
  }

  return (
    <div
      className={`rounded-2xl border bg-paper ${compact ? "p-2" : "p-3"} ${over ? "border-pine" : "border-line"}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        if (event.dataTransfer.files.length) takeFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-ink`}>Ô bình luận</p>
        <label className={`flex items-center gap-2 whitespace-nowrap text-ink ${compact ? "text-xs" : "text-sm"}`}>
          Số lượng
          <input
            type="number"
            min={1}
            max={100}
            value={boxes.length}
            onChange={(event) => onChange(resizeBoxes(boxes, Number(event.target.value)))}
            className={`${fieldClass} ${compact ? "h-8 w-16 px-2" : "w-20"}`}
          />
        </label>
      </div>
      <div
        className={`rounded-xl border border-dashed border-line bg-surface text-center text-muted ${
          compact ? "mt-2 px-2 py-2 text-xs leading-4" : "mt-3 px-3 py-4 text-sm leading-5"
        }`}
      >
        Kéo thả ảnh vào đây. Mỗi ảnh là một ô chat.
      </div>
      <ul className={`space-y-2 overflow-y-auto pr-1 ${compact ? "mt-2 max-h-40" : "mt-3 max-h-[28rem]"}`}>
        {boxes.map((box, index) => (
          <li key={box.key} className="flex items-start gap-2 rounded-2xl border border-line bg-surface p-2">
            <CommentPhotoButton
              compact={compact}
              photo={box.image?.url ? box.image : null}
              onPick={(file) =>
                onChange(
                  boxes.map((item) => {
                    if (item.key !== box.key) return item;
                    if (item.image?.url?.startsWith("blob:")) URL.revokeObjectURL(item.image.url);
                    return { ...item, image: { file, url: URL.createObjectURL(file), cleared: false } };
                  }),
                )
              }
              onClear={() =>
                onChange(
                  boxes.map((item) => {
                    if (item.key !== box.key) return item;
                    if (item.image?.url?.startsWith("blob:")) URL.revokeObjectURL(item.image.url);
                    return { ...item, image: { file: null, url: null, cleared: true } };
                  }),
                )
              }
            />
            <textarea
              value={box.text}
              onChange={(event) =>
                onChange(boxes.map((item) => (item.key === box.key ? { ...item, text: event.target.value } : item)))
              }
              rows={compact ? 2 : 3}
              className={`${areaClass} min-w-0 flex-1`}
              placeholder={`Bình luận ${index + 1}`}
            />
            <button
              type="button"
              aria-label={`Xóa bình luận ${index + 1}`}
              className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-line text-danger ${
                compact ? "h-8 w-8" : "h-9 w-9"
              }`}
              onClick={() => onChange(boxes.length === 1 ? [emptyBox()] : boxes.filter((item) => item.key !== box.key))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Action = "now" | "schedule" | "draft";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function initialItems(draft: ComposerDraft | null): MediaItem[] {
  if (draft?.videoUrl) {
    return [
      {
        key: `draft-${draft.id}`,
        kind: "video",
        name: "Video đã lưu",
        previewUrl: draft.videoUrl,
        file: null,
        coverBlob: null,
        coverPreviewUrl: draft.coverUrl,
        coverTime: null,
        caption: draft.message,
        picked: true,
        priority: false,
        fromDraft: true,
      },
    ];
  }
  if (draft?.imageUrl) {
    return [
      {
        key: `draft-${draft.id}`,
        kind: "image",
        name: "Ảnh đã lưu",
        previewUrl: draft.imageUrl,
        file: null,
        coverBlob: null,
        coverPreviewUrl: null,
        coverTime: null,
        caption: draft.message,
        picked: true,
        priority: false,
        fromDraft: true,
      },
    ];
  }
  return [];
}

function fileKind(file: File): "image" | "video" | null {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov)$/.test(name)) return "video";
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name)) return "image";
  return null;
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function FacebookPreview({
  item,
  page,
  caption,
  comments,
}: {
  item: MediaItem;
  page: ComposerPage | null;
  caption: string;
  comments: { text: string; image: string | null }[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [clock, setClock] = useState({ current: 0, duration: 0 });

  useEffect(() => {
    const node = textRef.current;
    if (!node || expanded) return;
    setOverflows(node.scrollHeight > node.clientHeight + 1);
  }, [caption, expanded]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
      return;
    }
    video.pause();
    setPlaying(false);
  }

  return (
    <article className="mt-4 overflow-hidden rounded-lg border border-[#dddfe2] bg-white text-left text-[#050505]">
      <div className="flex items-start gap-2 px-3 pt-3">
        {page?.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.pictureUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e4e6eb] text-sm font-semibold text-[#65676b]">
            {(page?.name || "F").slice(0, 1)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-5">{page?.name || "Fanpage"}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[13px] leading-4 text-[#65676b]">
            Công khai
            <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
              <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 1.8c1.8 1.8 2.6 4.2 2.6 6.2S9.8 12.4 8 14.2C6.2 12.4 5.4 10 5.4 8S6.2 3.6 8 1.8Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 8h12" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
        </span>
        <span className="px-1 text-xl leading-none text-[#65676b]" aria-hidden>
          ···
        </span>
      </div>
      <div className="px-3 pb-2 pt-2">
        <p
          ref={textRef}
          className={`whitespace-pre-wrap text-[15px] leading-5 ${expanded ? "" : "line-clamp-3"}`}
        >
          {caption || "Nội dung bài đăng"}
        </p>
        {overflows && !expanded ? (
          <button type="button" className="text-[15px] font-medium text-[#65676b]" onClick={() => setExpanded(true)}>
            Xem thêm
          </button>
        ) : null}
      </div>
      {item.kind === "video" ? (
        <div className="relative bg-black">
          <video
            ref={videoRef}
            key={item.previewUrl + (item.coverPreviewUrl || "")}
            src={item.previewUrl}
            poster={item.coverPreviewUrl || undefined}
            playsInline
            controls={playing}
            className="max-h-[32rem] w-full bg-black"
            onLoadedMetadata={(event) =>
              setClock({ current: 0, duration: event.currentTarget.duration })
            }
            onTimeUpdate={(event) =>
              setClock({ current: event.currentTarget.currentTime, duration: event.currentTarget.duration })
            }
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
          {playing ? null : (
            <button type="button" className="absolute inset-0" aria-label="Phát video" onClick={togglePlay}>
              <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-lg">
                <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 text-[#050505]" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7L8 5Z" />
                </svg>
              </span>
              <span className="absolute bottom-3 left-3 rounded-md bg-black/75 px-2 py-1 text-xs font-medium text-white">
                {formatClock(clock.current)} / {formatClock(clock.duration)}
              </span>
            </button>
          )}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt="" className="max-h-[32rem] w-full bg-black object-contain" />
      )}
      <div className="grid grid-cols-3 border-t border-[#dddfe2] text-[13px] font-semibold text-[#65676b]">
        <span className="flex items-center justify-center gap-1.5 py-2.5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M7 11v9H4v-9h3Zm3 9V10l5-6a2 2 0 0 1 2 2v4h4l-1 9H10Z" />
          </svg>
          Thích
        </span>
        <span className="flex items-center justify-center gap-1.5 py-2.5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 16.5 4 20l4.2-1.4A9 9 0 1 0 6 16.5Z" />
          </svg>
          Bình luận
        </span>
        <span className="flex items-center justify-center gap-1.5 py-2.5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M14 5h6v6M20 5l-8 8M10 7H5v12h12v-5" />
          </svg>
          Chia sẻ
        </span>
      </div>
      {comments.map((entry, index) =>
        entry.text || entry.image ? (
          <div key={`${entry.text}-${index}`} className="border-t border-[#dddfe2] px-3 py-2 text-[13px] leading-5">
            <span className="font-semibold">{page?.name || "Fanpage"} </span>
            {entry.text ? <span>{entry.text}</span> : null}
            {entry.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.image} alt="" className="mt-2 max-h-40 rounded-lg object-cover" />
            ) : null}
          </div>
        ) : null,
      )}
    </article>
  );
}

function formatWait(seconds: number) {
  if (seconds <= 0) return "không chờ thêm";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} giây`;
  if (rest === 0) return `${minutes} phút`;
  return `${minutes} phút ${rest} giây`;
}

function paceValue(mode: "fast" | "human", raw: string, min: number, max: number) {
  if (mode === "fast") return 0;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

function SpeedMode({
  title,
  mode,
  onMode,
  seconds,
  onSeconds,
  min,
  max,
  fastText,
  humanText,
  estimate,
}: {
  title: string;
  mode: "fast" | "human";
  onMode: (mode: "fast" | "human") => void;
  seconds: string;
  onSeconds: (value: string) => void;
  min: number;
  max: number;
  fastText: string;
  humanText: string;
  estimate: string;
}) {
  const [open, setOpen] = useState(true);
  const secondsRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = secondsRef.current;
    if (!node || !open || mode !== "human") return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = Number(node.value);
      const base = Number.isInteger(current) ? current : min;
      const next = event.deltaY < 0 ? Math.min(max, base + 1) : Math.max(min, base - 1);
      onSeconds(String(next));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [open, mode, min, max, onSeconds]);

  return (
    <div className="rounded-2xl border border-line bg-paper/40 p-3">
      <button
        type="button"
        role="switch"
        aria-checked={open}
        aria-label={open ? `Ẩn ${title}` : `Hiện ${title}`}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 text-left"
      >
        <SwitchKnob on={open} />
        <span className="text-sm font-medium text-ink">{title}</span>
      </button>
      {open ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["fast", "Nhanh"],
                ["human", "Giả lập người dùng"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => onMode(value)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  mode === value ? "border-pine bg-pine/10 text-pine" : "border-line bg-surface text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm leading-5 text-muted">{mode === "fast" ? fastText : humanText}</p>
          {mode === "human" ? (
            <label className={`${labelClass} mt-3`}>
              Giây chờ
              <input
                ref={secondsRef}
                value={seconds}
                onChange={(event) => onSeconds(event.target.value)}
                type="number"
                min={min}
                max={max}
                title="Lăn chuột để tăng hoặc giảm"
                className={`${fieldClass} mt-1.5`}
              />
            </label>
          ) : null}
          <p className="mt-2 text-sm font-medium text-ink">{estimate}</p>
        </>
      ) : null}
    </div>
  );
}

function pageStatusTone(status: string) {
  if (status === "success") return "text-pine";
  if (status === "failed") return "text-danger";
  if (status === "running" || status === "preparing") return "text-amber";
  if (status === "idle") return "text-muted";
  return "text-muted";
}

function pageStatusLabel(status: string) {
  if (status === "success") return "Đã đăng";
  if (status === "failed") return "Lỗi";
  if (status === "running" || status === "preparing") return "Đang đăng";
  if (status === "pending") return "Chờ đăng";
  if (status === "idle") return "Sẵn sàng";
  return status;
}

function pageBarClass(status: string) {
  if (status === "success") return "bg-pine";
  if (status === "failed") return "bg-danger";
  if (status === "running" || status === "preparing") return "bg-amber";
  if (status === "pending") return "bg-amber/40";
  return "bg-line";
}

function formatRunDuration(page: ComposerBatchPage) {
  const start = page.startedAt || page.runAt;
  if (!start) return null;
  const endMs =
    page.finishedAt != null
      ? new Date(page.finishedAt).getTime()
      : page.status === "running" || page.status === "preparing"
        ? Date.now()
        : null;
  if (endMs == null) return null;
  const seconds = Math.max(0, Math.round((endMs - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
}

function PageRunCard({
  page,
  href,
  batchMessage,
}: {
  page: ComposerBatchPage;
  href?: string | null;
  batchMessage?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const success = page.status === "success" ? 1 : 0;
  const failed = page.status === "failed" ? 1 : 0;
  const duration = formatRunDuration(page);
  const detailText = (page.message ?? batchMessage ?? "").trim();
  const hasDetail =
    page.status !== "idle" ||
    Boolean(detailText) ||
    Boolean(page.error) ||
    Boolean(page.fbPostId) ||
    Boolean(page.commentStatus && page.commentStatus !== "skipped");

  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <div className="flex items-center gap-3">
        {page.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.pictureUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-line"
          />
        ) : (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-semibold text-muted ring-1 ring-line">
            {page.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{page.name}</p>
          <p className={`mt-0.5 text-xs font-medium ${pageStatusTone(page.status)}`}>
            {pageStatusLabel(page.status)}
          </p>
        </div>
        {page.status !== "idle" ? (
          <StatusBadge status={page.status === "preparing" ? "running" : page.status} />
        ) : null}
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-line/80" aria-hidden>
        <span
          className={`h-full transition-[width] ${pageBarClass(page.status)}`}
          style={{
            width:
              page.status === "success" || page.status === "failed"
                ? "100%"
                : page.status === "running" || page.status === "preparing"
                  ? "60%"
                  : page.status === "pending"
                    ? "20%"
                    : "0%",
          }}
        />
      </div>

      {page.status !== "idle" ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-4 text-muted">
          <span className="text-pine">{success} thành công</span>
          <span className={failed ? "text-danger" : undefined}>{failed} lỗi</span>
          <span>Chạy: {duration ?? "—"}</span>
        </div>
      ) : null}

      {hasDetail ? (
        <div className="mt-2 border-t border-line/80 pt-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-ink"
          >
            <span>Chi tiết bài đăng</span>
            <svg
              viewBox="0 0 20 20"
              className={`h-3.5 w-3.5 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
            </svg>
          </button>
          {open ? (
            <div className="mt-2 space-y-2 text-xs leading-5 text-muted">
              {detailText ? (
                <p className="whitespace-pre-wrap text-ink">{detailText.slice(0, 280)}</p>
              ) : (
                <p>(không có chữ)</p>
              )}
              {page.error ? <p className="text-danger">{page.error}</p> : null}
              {page.commentStatus && page.commentStatus !== "skipped" ? (
                <p>
                  Bình luận:{" "}
                  {page.commentStatus === "success"
                    ? "đã bình luận"
                    : page.commentStatus === "pending"
                      ? "đang bình luận"
                      : page.commentStatus === "failed"
                        ? page.commentError || "bình luận lỗi"
                        : page.commentStatus}
                </p>
              ) : null}
              {page.finishedAt ? <p>Xong lúc {formatWhen(page.finishedAt)}</p> : null}
              {page.runAt && page.status === "pending" ? (
                <p>Dự kiến {formatWhen(page.runAt)}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {page.fbPostId ? (
                  <a
                    href={`https://www.facebook.com/${page.fbPostId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-pine hover:underline"
                  >
                    Xem trên Facebook
                  </a>
                ) : null}
                {href ? (
                  <Link href={href} className="font-medium text-pine hover:underline">
                    Nhật ký đợt
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PageProgressPanel({
  pages,
  selected,
  latest,
}: {
  pages: ComposerPage[];
  selected: string[];
  latest: ComposerBatch | null;
}) {
  const [livePages, setLivePages] = useState<ComposerBatchPage[] | null>(null);
  const batchId = latest?.id ?? null;
  const batchActive =
    latest != null && latest.status !== "finished" && latest.status !== "draft";

  useEffect(() => {
    if (!batchId || !batchActive) {
      setLivePages(null);
      return;
    }
    let stop = false;
    let timer = 0;

    async function load() {
      const response = await fetch(`/api/batches/${batchId}`);
      const data = await response.json();
      if (stop || !response.ok) return;
      const jobs = (data.batch?.jobs ?? []) as {
        pageName: string;
        status: string;
        error?: string | null;
        fbPostId?: string | null;
        commentStatus?: string | null;
        commentError?: string | null;
        runAt?: string | null;
        startedAt?: string | null;
        finishedAt?: string | null;
      }[];
      const batchMessage = (data.batch?.message as string | undefined) ?? latest?.message ?? null;
      setLivePages(
        jobs.map((job) => {
          const known =
            latest?.pages.find((page) => page.name === job.pageName) ??
            pages.find((page) => page.name === job.pageName);
          return {
            id: known?.id ?? job.pageName,
            name: job.pageName,
            pictureUrl: known?.pictureUrl ?? null,
            status: job.status,
            error: job.error ?? null,
            fbPostId: job.fbPostId ?? null,
            commentStatus: job.commentStatus ?? null,
            commentError: job.commentError ?? null,
            runAt: job.runAt ?? null,
            startedAt: job.startedAt ?? null,
            finishedAt: job.finishedAt ?? null,
            message: batchMessage,
          };
        }),
      );
      const done = data.batch?.status === "finished" || data.batch?.status === "draft";
      if (!done) timer = window.setTimeout(load, 2500);
    }

    load();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [batchId, batchActive, latest?.pages, pages]);

  const slots: ComposerBatchPage[] = (() => {
    if (selected.length > 0) {
      const canUseBatch =
        Boolean(latest) &&
        (batchActive ||
          selected.every((id) => latest!.pages.some((page) => page.id === id)));
      return selected
        .map((id) => pages.find((page) => page.id === id))
        .filter((page): page is ComposerPage => Boolean(page))
        .map((page) => {
          const live = livePages?.find((row) => row.id === page.id || row.name === page.name);
          const fromBatch = canUseBatch
            ? latest?.pages.find((row) => row.id === page.id || row.name === page.name)
            : undefined;
          const source = live ?? fromBatch;
          return {
            id: page.id,
            name: page.name,
            pictureUrl: page.pictureUrl,
            status: source?.status ?? "idle",
            error: source?.error ?? null,
            fbPostId: source?.fbPostId ?? null,
            commentStatus: source?.commentStatus ?? null,
            commentError: source?.commentError ?? null,
            runAt: source?.runAt ?? null,
            startedAt: source?.startedAt ?? null,
            finishedAt: source?.finishedAt ?? null,
            message: source?.message ?? latest?.message ?? null,
          };
        });
    }
    if (livePages?.length) return livePages;
    return latest?.pages ?? [];
  })();

  const delayLabel = latest
    ? latest.delaySeconds === 0
      ? "Đăng nhanh"
      : `Chờ ${latest.delaySeconds} giây giữa các Page`
    : null;

  return (
    <div className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Tiến độ Page</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {slots.length
              ? `${slots.length} Page · ${delayLabel ?? "Chọn Page rồi đăng để theo dõi kết quả"}`
              : "Chọn Fanpage để hiện từng ô tiến độ."}
          </p>
        </div>
        {latest ? <StatusBadge status={latest.status} /> : null}
      </div>
      {slots.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Chưa có Page nào.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {slots.map((page) => (
            <li key={page.id}>
              <PageRunCard
                page={page}
                href={latest ? `/batches/${latest.id}` : null}
                batchMessage={latest?.message ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Composer({
  facebookName,
  pages,
  batches,
  initialDraft,
  notice,
}: {
  facebookName: string | null;
  pages: ComposerPage[];
  batches: ComposerBatch[];
  initialDraft?: ComposerDraft | null;
  notice?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<MediaItem[]>([]);
  const [selected, setSelected] = useState<string[]>(initialDraft?.pageIds ?? []);
  const [pageQuery, setPageQuery] = useState("");
  const [showPages, setShowPages] = useState(true);
  const [message, setMessage] = useState(initialDraft?.message ?? "");
  const initialDelay = initialDraft?.delaySeconds ?? 45;
  const initialCommentDelay = initialDraft?.commentDelaySeconds ?? 0;
  const [postMode, setPostMode] = useState<"fast" | "human">(initialDelay === 0 ? "fast" : "human");
  const [postGap, setPostGap] = useState(String(initialDelay === 0 ? 45 : initialDelay));
  const [commentMode, setCommentMode] = useState<"fast" | "human">(initialCommentDelay === 0 ? "fast" : "human");
  const [commentGap, setCommentGap] = useState(String(initialCommentDelay === 0 ? 20 : initialCommentDelay));
  const [commentEnabled, setCommentEnabled] = useState(initialDraft?.commentEnabled ?? false);
  const [separateComments, setSeparateComments] = useState(initialDraft?.separateComments ?? false);
  const [commentBoxes, setCommentBoxes] = useState<ChatBox[]>(() => boxesFrom(initialDraft?.comments));
  const [pageBoxes, setPageBoxes] = useState<Record<string, ChatBox[]>>(() => {
    const map: Record<string, ChatBox[]> = {};
    for (const row of initialDraft?.pageComments ?? []) {
      if (row.comments.length) map[row.pageId] = boxesFrom(row.comments);
    }
    return map;
  });
  const [openPages, setOpenPages] = useState<Record<string, boolean>>({});
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(initialDraft?.scheduledAt ?? null));
  const [items, setItems] = useState<MediaItem[]>(() => initialItems(initialDraft ?? null));
  const [separateContent, setSeparateContent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [draftId, setDraftId] = useState(initialDraft?.id ?? "");
  const startedWithCover = Boolean(initialDraft?.coverUrl);

  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
        if (item.coverPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.coverPreviewUrl);
      }
    };
  }, []);

  function updateItem(key: string, patch: Partial<MediaItem>) {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const next = { ...item, ...patch };
        if (
          item.coverPreviewUrl?.startsWith("blob:") &&
          item.coverPreviewUrl !== next.coverPreviewUrl
        ) {
          URL.revokeObjectURL(item.coverPreviewUrl);
        }
        return next;
      }),
    );
  }

  function removeItem(key: string) {
    setItems((current) => {
      const item = current.find((row) => row.key === key);
      if (item?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      if (item?.coverPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.coverPreviewUrl);
      return current.filter((row) => row.key !== key);
    });
    setEditingKey((current) => (current === key ? null : current));
    setPreviewKey((current) => (current === key ? null : current));
  }

  function togglePriority(key: string) {
    setItems((current) => {
      const updated = current.map((row) =>
        row.key === key
          ? { ...row, priority: !row.priority, picked: !row.priority ? true : row.picked }
          : row,
      );
      const ranked = updated.filter((row) => row.priority);
      const rest = updated.filter((row) => !row.priority);
      return [...ranked, ...rest];
    });
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    if (incoming.length === 0) return;
    const accepted: MediaItem[] = [];
    let problem = "";
    for (const file of incoming) {
      const kind = fileKind(file);
      if (!kind) {
        problem = `${file.name}: chỉ nhận ảnh JPG, PNG, WEBP hoặc video MP4, WEBM, MOV.`;
        continue;
      }
      if (kind === "video" && file.size > 80 * 1024 * 1024) {
        problem = `${file.name}: video tối đa 80MB.`;
        continue;
      }
      if (kind === "image" && file.size > 8 * 1024 * 1024) {
        problem = `${file.name}: ảnh tối đa 8MB.`;
        continue;
      }
      accepted.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        kind,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        file,
        coverBlob: null,
        coverPreviewUrl: null,
        coverTime: null,
        caption: "",
        picked: true,
        priority: false,
        fromDraft: false,
      });
    }
    setError(problem);
    if (accepted.length > 0) setItems((current) => [...current, ...accepted]);
  }

  async function submit(action: Action) {
    const chosen = [
      ...items.filter((item) => item.picked && item.priority),
      ...items.filter((item) => item.picked && !item.priority),
    ];
    const manyContents = separateContent && items.length > 1;
    if (action !== "draft" && selected.length === 0) {
      setError("Chọn ít nhất một Page.");
      return;
    }
    if (items.length > 0 && chosen.length === 0) {
      setError("Chọn ít nhất một tệp.");
      return;
    }
    if (action === "schedule" && !scheduledAt) {
      setError("Chọn ngày giờ đăng.");
      return;
    }
    if (commentEnabled && action !== "draft") {
      const ready = (box: ChatBox) => Boolean(box.text.trim() || (box.image?.url && !box.image.cleared));
      if (!separateComments) {
        const missing = commentBoxes.findIndex((box) => !ready(box));
        if (missing >= 0) {
          setError(`Nhập chữ hoặc ảnh cho bình luận ${missing + 1}.`);
          return;
        }
      } else if (selected.length === 0) {
        setError("Chọn Fanpage để soạn bình luận riêng.");
        return;
      } else {
        const missingPage = pages.find((page) => selected.includes(page.id));
        for (const page of pages.filter((item) => selected.includes(item.id))) {
          const boxes = pageBoxes[page.id] ?? commentBoxes;
          const missing = boxes.findIndex((box) => !ready(box));
          if (missing >= 0) {
            setError(`Nhập chữ hoặc ảnh cho bình luận ${missing + 1} của ${page.name}.`);
            return;
          }
        }
        if (!missingPage) {
          setError("Chọn Fanpage để soạn bình luận riêng.");
          return;
        }
      }
    }
    if (manyContents && chosen.some((item) => !item.caption.trim())) {
      setError("Nhập nội dung riêng cho từng tệp đang chọn.");
      return;
    }
    const postDelay = paceValue(postMode, postGap, 10, 600);
    const commentDelay = paceValue(commentMode, commentGap, 5, 180);
    if (postDelay === null) {
      setError("Giả lập đăng bài chờ từ 10 đến 600 giây.");
      return;
    }
    if (commentEnabled && commentDelay === null) {
      setError("Giả lập bình luận chờ từ 5 đến 180 giây.");
      return;
    }
    const targets = chosen.length > 0 ? chosen : [null];
    setPending(action);
    setError("");
    setSavedNote("");
    const saved: { id: string; status: string }[] = [];
    const doneKeys = new Set<string>();
    for (const item of targets) {
      const form = new FormData();
      const text = manyContents && item ? item.caption.trim() : message;
      form.set("action", action);
      form.set("message", text);
      form.set("delaySeconds", String(postDelay));
      form.set("commentDelaySeconds", String(commentEnabled ? commentDelay : 0));
      if (commentEnabled) form.set("commentEnabled", "1");
      const slotPayload = (boxes: ChatBox[]) =>
        boxes.map((box) => ({
          text: box.text,
          clearImage: Boolean(box.image?.cleared && !box.image.file),
          keepIndex: box.storedIndex,
        }));
      if (separateComments) {
        form.set("separateComments", "1");
        form.set("commentText", "");
        form.set(
          "pageComments",
          JSON.stringify(
            selected.map((id) => ({
              pageId: id,
              comments: slotPayload(pageBoxes[id] ?? commentBoxes),
            })),
          ),
        );
        for (const id of selected) {
          (pageBoxes[id] ?? commentBoxes).forEach((box, index) => {
            if (box.image?.file) form.set(`commentFile_${id}_${index}`, box.image.file);
          });
        }
      } else {
        form.set("comments", JSON.stringify(slotPayload(commentBoxes)));
        commentBoxes.forEach((box, index) => {
          if (box.image?.file) form.set(`commentFile_${index}`, box.image.file);
        });
      }
      if (item?.fromDraft && draftId) form.set("draftId", draftId);
      if (scheduledAt) form.set("scheduledAt", new Date(scheduledAt).toISOString());
      selected.forEach((id) => form.append("pageIds", id));
      if (item?.file && item.kind === "image") form.set("image", item.file);
      if (item?.file && item.kind === "video") form.set("video", item.file);
      if (item?.coverBlob) {
        form.set("cover", new File([item.coverBlob], "cover.jpg", { type: "image/jpeg" }));
      } else if (item?.fromDraft && item.kind === "video" && startedWithCover && !item.coverPreviewUrl) {
        form.set("clearCover", "1");
      }
      const response = await fetch("/api/batches", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        setItems((current) => current.filter((row) => !doneKeys.has(row.key)));
        setError(`${item?.name ? `${item.name}: ` : ""}${data.error || "Không lưu được bài."}`);
        setPending(null);
        router.refresh();
        return;
      }
      saved.push(data);
      if (item) doneKeys.add(item.key);
    }
    if (saved.length === 1 && saved[0].status === "draft") {
      setDraftId(saved[0].id);
      setSavedNote("Đã lưu nháp.");
      setPending(null);
      router.replace(`/tool?draft=${saved[0].id}&saved=1`);
      router.refresh();
      return;
    }
    if (saved.length === 1) {
      setPending(null);
      setSavedNote("Đã xếp bài. Theo dõi từng Page bên phải.");
      router.refresh();
      return;
    }
    setItems((current) => current.filter((row) => !doneKeys.has(row.key)));
    setSavedNote(action === "draft" ? `Đã lưu ${saved.length} nháp.` : `Đã xếp ${saved.length} bài.`);
    setPending(null);
    router.refresh();
  }

  const allSelected = pages.length > 0 && selected.length === pages.length;
  const allPicked = items.length > 0 && items.every((item) => item.picked);
  const videoCount = items.filter((item) => item.kind === "video").length;
  const editing = items.find((item) => item.key === editingKey && item.kind === "video") ?? null;
  const previewItem = items.find((item) => item.key === previewKey) ?? null;
  const manyContents = separateContent && items.length > 1;
  const previewPage = pages.find((page) => selected.includes(page.id)) ?? null;
  const previewCaption = previewItem
    ? manyContents
      ? previewItem.caption.trim()
      : message.trim()
    : "";
  const previewComments = (() => {
    if (!commentEnabled) return [];
    const source = separateComments && previewPage ? pageBoxes[previewPage.id] ?? commentBoxes : commentBoxes;
    const filled = source
      .filter((box) => box.text.trim() || (box.image?.url && !box.image.cleared))
      .map((box) => ({ text: box.text.trim(), image: box.image?.url && !box.image.cleared ? box.image.url : null }));
    return filled.length ? filled : [{ text: "Nội dung bình luận", image: null }];
  })();
  const readyCount = (boxes: ChatBox[]) =>
    boxes.filter((box) => box.text.trim() || (box.image?.url && !box.image.cleared)).length;
  const pageCount = selected.length;
  const fileRuns = items.length === 0 ? 1 : items.filter((item) => item.picked).length;
  const postDelay = paceValue(postMode, postGap, 10, 600);
  const postEstimate = (() => {
    if (pageCount === 0) return "Ước tính: chọn Fanpage để tính thời gian.";
    if (fileRuns === 0) return "Ước tính: chọn tệp để tính thời gian.";
    if (postMode === "fast" || postDelay === 0) {
      return `Ước tính: không chờ giữa ${pageCount} Page${fileRuns > 1 ? `, ${fileRuns} tệp` : ""}. Thời gian là lúc Facebook nhận bài.`;
    }
    if (postDelay === null) return "Ước tính: nhập số giây từ 10 đến 600.";
    if (pageCount === 1) return "Ước tính: một Page thì không có khoảng chờ.";
    const wait = fileRuns * (pageCount - 1) * postDelay;
    return `Ước tính chờ khoảng ${formatWait(wait)} giữa các Page.`;
  })();
  const commentEstimate = (() => {
    if (pageCount === 0) return "Ước tính: chọn Fanpage để tính thời gian.";
    const counts = separateComments
      ? selected.map((id) => readyCount(pageBoxes[id] ?? commentBoxes))
      : selected.map(() => readyCount(commentBoxes));
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total === 0) return "Ước tính: chưa có bình luận để tính.";
    if (commentMode === "fast") return "Ước tính: bình luận gửi liền nhau, không chờ thêm.";
    const gap = paceValue("human", commentGap, 5, 180);
    if (gap === null) return "Ước tính: nhập số giây từ 5 đến 180.";
    const wait = counts.reduce((sum, count) => sum + Math.max(0, count - 1) * gap, 0) * Math.max(fileRuns, 1);
    if (wait === 0) return "Ước tính: mỗi Page một bình luận, không có khoảng chờ.";
    return `Ước tính chờ thêm khoảng ${formatWait(wait)} cho các bình luận.`;
  })();

  return (
    <>
      <main className="grid w-full gap-6 px-4 py-8 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start lg:px-6 xl:gap-8 xl:px-8">
        <section className="space-y-6">
          {notice ? (
            <p className="rounded-xl border border-pine/20 bg-pine/5 px-4 py-3 text-sm leading-6 text-ink">
              {notice}
            </p>
          ) : null}
          <div className={`${cardClass} relative overflow-hidden p-5 sm:p-6`}>
            <div className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full bg-moss/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 right-16 h-36 w-36 rounded-full bg-[#1877f2]/10 blur-2xl" />
            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Soạn bài</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  Viết nội dung, gắn ảnh hoặc video, chọn một hoặc nhiều Fanpage. Đăng ngay, hẹn giờ, hoặc lưu nháp.
                </p>
                <p
                  className={`mt-4 inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${
                    facebookName
                      ? "bg-moss/10 text-moss ring-1 ring-inset ring-moss/20"
                      : "bg-amber/10 text-amber ring-1 ring-inset ring-amber/20"
                  }`}
                >
                  {facebookName ? (
                    <>
                      Page đang lấy từ tài khoản <span className="font-semibold">{facebookName}</span>
                    </>
                  ) : (
                    "Admin chưa gắn mã khóa, nên chưa có Page để đăng."
                  )}
                </p>
              </div>
              <div className="relative mx-auto hidden h-28 w-40 sm:block lg:mx-0" aria-hidden>
                <span className="absolute left-4 top-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1877f2] text-2xl font-bold text-white shadow-[0_10px_24px_rgba(24,119,242,0.35)]">
                  f
                </span>
                <span className="absolute bottom-2 right-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-moss text-white shadow-[0_10px_24px_rgba(15,110,86,0.35)]">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                    <path d="M3.2 11.4 20 4.6l-4.2 15.3-3.4-5.1-4.1 3.1 1.2-6.4-6.3-.1Z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-5 sm:p-6`}>
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">
                  Chọn Fanpage
                  {pages.length > 0 ? (
                    <span className="ml-2 font-medium text-muted">
                      {selected.length}/{pages.length}
                    </span>
                  ) : null}
                </h2>
                {pages.length > 0 ? (
                  <button
                    type="button"
                    aria-pressed={showPages}
                    aria-label={showPages ? "Ẩn danh sách Fanpage" : "Hiện danh sách Fanpage"}
                    title={showPages ? "Ẩn" : "Hiện"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:border-pine/40 hover:bg-paper"
                    onClick={() => setShowPages((value) => !value)}
                  >
                    {showPages ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                ) : null}
              </div>
              {pages.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-paper/70 px-4 py-5 text-sm leading-6 text-muted">
                  {facebookName
                    ? "Chưa có Page trong mã admin vừa gắn."
                    : "Chờ admin nhập mã khóa Facebook."}
                </p>
              ) : showPages ? (
                <>
                  <input
                    id="fanpage-search"
                    value={pageQuery}
                    onChange={(event) => setPageQuery(event.target.value)}
                    className={fieldClass}
                    placeholder="Tìm Fanpage..."
                  />
                  <div className="mt-2 flex justify-start">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-pine">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(node) => {
                          if (node) {
                            node.indeterminate = selected.length > 0 && !allSelected;
                          }
                        }}
                        onChange={() =>
                          setSelected(allSelected ? [] : pages.map((page) => page.id))
                        }
                        className="h-4 w-4 shrink-0"
                      />
                      {allSelected ? "Bỏ chọn" : "Chọn tất cả"}
                    </label>
                  </div>
                  <ul className="mt-3 max-h-[28rem] space-y-2 overflow-auto pr-1">
                    {pages
                      .filter((page) => page.name.toLowerCase().includes(pageQuery.trim().toLowerCase()))
                      .map((page) => {
                        const active = selected.includes(page.id);
                        return (
                          <li key={page.id}>
                            <label
                              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                                active ? "border-pine bg-pine/5" : "border-line bg-surface hover:border-pine/30"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() =>
                                  setSelected((current) =>
                                    current.includes(page.id)
                                      ? current.filter((item) => item !== page.id)
                                      : [...current, page.id],
                                  )
                                }
                                onClick={(event) => event.stopPropagation()}
                                className="h-4 w-4 shrink-0"
                              />
                              {page.pictureUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={page.pictureUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-line"
                                />
                              ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-muted ring-1 ring-line">
                                  {page.name.slice(0, 1)}
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-ink">{page.name}</span>
                                {page.category ? (
                                  <span className="block truncate text-xs text-muted">{page.category}</span>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-line bg-paper/70 px-4 py-3 text-sm text-muted">
                  Đã ẩn danh sách. Đã chọn {selected.length}/{pages.length} Page.
                </p>
              )}
            </div>
          </div>

          <div className={`${cardClass} space-y-5 p-5 sm:p-6`}>
            {manyContents ? null : (
              <label className={labelClass}>
                Nội dung
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  className={`${areaClass} mt-1.5`}
                  placeholder="Nội dung bài đăng"
                />
              </label>
            )}

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                addFiles(event.dataTransfer.files);
              }}
              className={`rounded-xl border border-dashed p-3 ${
                dragOver ? "border-pine bg-pine/5" : "border-line bg-paper/40"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={allPicked}
                    disabled={items.length === 0}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() =>
                      setItems((current) => current.map((item) => ({ ...item, picked: !allPicked })))
                    }
                    className="h-4 w-4"
                  />
                  Chọn tất cả
                </label>
                <p className="text-sm text-muted">
                  <span className="font-semibold text-ink">{videoCount}</span> video
                </p>
                <button type="button" className={quietButtonClass} onClick={() => fileRef.current?.click()}>
                  Thêm video
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              {items.length > 1 ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={separateContent}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSeparateContent((on) => !on);
                  }}
                  className="mt-3 flex w-full items-start gap-2 text-left"
                >
                  <SwitchKnob on={separateContent} compact />
                  <span className="text-xs font-medium leading-4 text-ink">
                    Đăng nhiều nội dung khác nhau, mỗi tệp một nội dung
                  </span>
                </button>
              ) : null}
              {items.length === 0 ? (
                <button
                  type="button"
                  className="mt-3 flex w-full flex-col items-center rounded-xl px-4 py-8 text-sm text-muted"
                  onClick={() => fileRef.current?.click()}
                >
                  Kéo thả ảnh hoặc video vào đây
                </button>
              ) : (
                <ul className="mt-3 max-h-[30.5rem] space-y-2 overflow-y-auto pr-1">
                  {items.map((item) => {
                    const priorityRank = item.priority
                      ? items.filter((row) => row.priority).findIndex((row) => row.key === item.key) + 1
                      : 0;
                    return (
                    <li
                      key={item.key}
                      className={`rounded-xl border bg-surface p-3 ${
                        item.priority
                          ? "border-pine/50"
                          : previewKey === item.key
                            ? "border-pine"
                            : "border-line"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.picked}
                          aria-label={`Chọn ${item.name}`}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() =>
                            updateItem(item.key, {
                              picked: !item.picked,
                              priority: item.picked ? false : item.priority,
                            })
                          }
                          className="h-4 w-4 shrink-0"
                        />
                        {item.coverPreviewUrl || item.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.coverPreviewUrl || item.previewUrl}
                            alt=""
                            className="h-16 w-12 shrink-0 rounded-md object-cover ring-1 ring-line"
                          />
                        ) : (
                          <video
                            src={item.previewUrl}
                            muted
                            playsInline
                            className="h-16 w-12 shrink-0 rounded-md bg-black object-cover ring-1 ring-line"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                          {item.priority ? (
                            <p className="text-xs font-medium text-pine">
                              Ưu tiên đăng trước · #{priorityRank}
                            </p>
                          ) : null}
                        </div>
                        {item.kind === "video" ? (
                          <button
                            type="button"
                            className={quietButtonClass}
                            onClick={() => setEditingKey(item.key)}
                          >
                            Tùy chọn chỉnh sửa
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label={
                            item.priority
                              ? `Bỏ ưu tiên ${item.name}`
                              : `Ưu tiên đăng ${item.name}`
                          }
                          aria-pressed={item.priority}
                          title="Ưu tiên đăng trước"
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
                            item.priority
                              ? "border-pine bg-pine/10 text-pine"
                              : "border-line text-muted hover:border-pine/40 hover:text-pine"
                          }`}
                          onClick={() => togglePriority(item.key)}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill={item.priority ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path strokeLinejoin="round" d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Xem trước ${item.name}`}
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
                            previewKey === item.key
                              ? "border-pine bg-pine/10 text-pine"
                              : "border-line text-ink hover:border-pine/40"
                          }`}
                          onClick={() => setPreviewKey(item.key)}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa ${item.name}`}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-danger hover:bg-danger/5"
                          onClick={() => removeItem(item.key)}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
                          </svg>
                        </button>
                      </div>
                      {manyContents ? (
                        <textarea
                          value={item.caption}
                          onChange={(event) => updateItem(item.key, { caption: event.target.value })}
                          rows={3}
                          className={`${areaClass} mt-3`}
                          placeholder="Mô tả để mọi người nắm được nội dung"
                        />
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={commentEnabled}
              onClick={() => setCommentEnabled((on) => !on)}
              className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface px-3 py-3 text-left"
            >
              <SwitchKnob on={commentEnabled} />
              <span>
                <span className="block text-sm font-medium text-ink">Tự bình luận sau khi đăng</span>
                <span className="mt-1 block text-sm leading-5 text-muted">
                  Mỗi Fanpage tự bình luận dưới bài của chính page đó, bằng token của Page. Nếu bình luận lỗi, bài vẫn giữ, không đăng lại.
                </span>
              </span>
            </button>
            {commentEnabled ? (
              <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={separateComments}
                  onClick={() => {
                    const on = !separateComments;
                    setSeparateComments(on);
                    if (!on) return;
                    setPageBoxes((current) => {
                      const next = { ...current };
                      for (const id of selected) {
                        if (next[id]?.length) continue;
                        next[id] = commentBoxes.map((box) => ({
                          ...box,
                          key: Math.random().toString(36).slice(2),
                        }));
                      }
                      return next;
                    });
                  }}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <SwitchKnob on={separateComments} />
                  <span>
                    <span className="block text-sm font-medium text-ink">Bình luận khác nhau cho từng Page</span>
                    <span className="mt-1 block text-sm leading-5 text-muted">
                      Mỗi Fanpage có số lượng và ảnh bình luận riêng.
                    </span>
                  </span>
                </button>
                {separateComments ? (
                  selected.length === 0 ? (
                    <p className="text-sm text-muted">Chọn Fanpage ở đầu trang để soạn bình luận riêng.</p>
                  ) : (
                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {pages
                        .filter((page) => selected.includes(page.id))
                        .map((page) => {
                          const open = openPages[page.id] !== false;
                          return (
                            <div key={page.id} className="rounded-xl border border-line bg-paper/40 p-2">
                              <div className="flex items-center gap-2">
                                {page.pictureUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={page.pictureUrl}
                                    alt=""
                                    className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-line"
                                  />
                                ) : (
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-muted ring-1 ring-line">
                                    {page.name.slice(0, 1)}
                                  </span>
                                )}
                                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{page.name}</p>
                                <button
                                  type="button"
                                  aria-pressed={open}
                                  aria-label={open ? `Ẩn bình luận ${page.name}` : `Hiện bình luận ${page.name}`}
                                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                                    open ? "text-pine" : "text-muted"
                                  }`}
                                  onClick={() =>
                                    setOpenPages((current) => ({
                                      ...current,
                                      [page.id]: current[page.id] === false,
                                    }))
                                  }
                                >
                                  {open ? (
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                  ) : (
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M3 3l18 18" />
                                      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2" />
                                      <path d="M9.9 5.1A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2" />
                                      <path d="M6.6 6.6C4.2 8.2 2.4 10.5 2 12c1.4 2.6 3.6 4.9 6.1 6A11 11 0 0 0 12 19c1 0 2-.1 2.9-.4" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                              {open ? (
                                <div className="mt-2">
                                  <CommentZone
                                    compact
                                    boxes={pageBoxes[page.id] ?? commentBoxes}
                                    onProblem={setError}
                                    onChange={(next) =>
                                      setPageBoxes((current) => {
                                        const previous = current[page.id] ?? commentBoxes;
                                        revokeGone(previous, next, (url) =>
                                          commentBoxes.some((box) => box.image?.url === url),
                                        );
                                        return { ...current, [page.id]: next };
                                      })
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  )
                ) : (
                  <CommentZone
                    boxes={commentBoxes}
                    onProblem={setError}
                    onChange={(next) =>
                      setCommentBoxes((current) => {
                        revokeGone(current, next, (url) =>
                          Object.values(pageBoxes).some((list) => list.some((box) => box.image?.url === url)),
                        );
                        return next;
                      })
                    }
                  />
                )}
              </div>
            ) : null}

            <SpeedMode
              title="Tốc độ đăng"
              mode={postMode}
              onMode={setPostMode}
              seconds={postGap}
              onSeconds={setPostGap}
              min={10}
              max={600}
              fastText="Đăng xong Page này là tới Page tiếp theo, nhanh nhất tool làm được."
              humanText="Chờ giữa các Page giống người đang đăng. Bạn chỉnh số giây cho hợp nhịp."
              estimate={postEstimate}
            />
            {commentEnabled ? (
              <SpeedMode
                title="Tốc độ bình luận"
                mode={commentMode}
                onMode={setCommentMode}
                seconds={commentGap}
                onSeconds={setCommentGap}
                min={5}
                max={180}
                fastText="Các bình luận của một Page gửi liền nhau ngay sau khi bài của Page đó lên."
                humanText="Chờ giữa các bình luận của cùng một Page. Bạn chỉnh số giây."
                estimate={commentEstimate}
              />
            ) : null}
            <label className={labelClass}>
              Giờ đăng khi lên lịch
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className={`${fieldClass} mt-1.5`}
              />
            </label>
            <p className="text-sm leading-5 text-muted">
              Đến giờ đã chọn, tool mới đăng bài. Fanpage chỉ bình luận sau khi bài của page đó đã lên.
            </p>

            {error ? <ErrorNote>{error}</ErrorNote> : null}
            {savedNote ? (
              <p className="rounded-lg bg-pine/10 px-3 py-2 text-sm text-pine">{savedNote}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={pending !== null || selected.length === 0}
                onClick={() => submit("now")}
              >
                {pending === "now" ? "Đang xếp hàng..." : "Đăng ngay"}
              </button>
              <button
                type="button"
                className={quietButtonClass}
                disabled={pending !== null || selected.length === 0}
                onClick={() => submit("schedule")}
              >
                {pending === "schedule" ? "Đang hẹn giờ..." : "Lên lịch"}
              </button>
              <button
                type="button"
                className={quietButtonClass}
                disabled={pending !== null}
                onClick={() => submit("draft")}
              >
                {pending === "draft" ? "Đang lưu..." : "Lưu nháp"}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto">
          <div className={`${cardClass} p-4 sm:p-5`}>
            <h2 className="text-sm font-semibold text-ink">Xem trước</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Bài sẽ hiện trên Facebook. Bấm biểu tượng mắt ở hàng tệp để xem đúng ảnh hoặc video đó.
            </p>
            {previewItem ? (
              <FacebookPreview
                key={previewItem.key}
                item={previewItem}
                page={previewPage}
                caption={previewCaption}
                comments={previewComments}
              />
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-line bg-paper/50 px-4 py-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-muted ring-1 ring-line">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                    <rect x="4" y="5" width="16" height="14" rx="2" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path strokeLinejoin="round" d="m8 16 3-3 2 2 3-3 2 2" />
                  </svg>
                </span>
                <p className="mt-3 text-sm leading-6 text-muted">Chưa chọn tệp để xem trước.</p>
              </div>
            )}
          </div>
          <PageProgressPanel pages={pages} selected={selected} latest={batches[0] ?? null} />
        </aside>
      </main>
      {editing ? (
        <CoverEditor
          videoUrl={editing.previewUrl}
          open
          initialTime={editing.coverTime}
          onClose={() => setEditingKey(null)}
          onUse={(blob, previewUrl, time) => {
            updateItem(editing.key, {
              coverBlob: blob,
              coverPreviewUrl: previewUrl,
              coverTime: time,
            });
            setEditingKey(null);
          }}
        />
      ) : null}
    </>
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

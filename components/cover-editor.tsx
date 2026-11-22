"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass, ErrorNote, quietButtonClass } from "@/components/ui";

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function seekAndDraw(video: HTMLVideoElement, time: number) {
  return new Promise<string>((resolve, reject) => {
    const finish = () => {
      const width = video.videoWidth || 320;
      const height = video.videoHeight || 180;
      const scale = Math.min(1, 160 / width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Không vẽ được khung hình."));
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    if (Math.abs(video.currentTime - time) < 0.05 && video.readyState >= 2) {
      finish();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      finish();
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", () => reject(new Error("Không đọc được video.")), { once: true });
    video.currentTime = time;
  });
}

async function captureStrip(src: string) {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Không đọc được video."));
  });
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Video này chưa có thời lượng. Hãy dùng file MP4.");
  }
  const frames: { time: number; url: string }[] = [];
  const count = 8;
  for (let index = 0; index < count; index += 1) {
    const time = Math.min(duration * ((index + 0.5) / count), Math.max(0, duration - 0.05));
    frames.push({ time, url: await seekAndDraw(video, time) });
  }
  return { duration, frames };
}

function frameBlob(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || canvas.width === 0) {
    return Promise.reject(new Error("Chưa lấy được khung hình. Kéo thanh thời gian rồi thử lại."));
  }
  context.drawImage(video, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không xuất được ảnh bìa."))),
      "image/jpeg",
      0.92,
    );
  });
}

export function CoverEditor({
  videoUrl,
  open,
  initialTime,
  onClose,
  onUse,
}: {
  videoUrl: string;
  open: boolean;
  initialTime: number | null;
  onClose: () => void;
  onUse: (blob: Blob, previewUrl: string, time: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [frames, setFrames] = useState<{ time: number; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let stop = false;
    setFrames([]);
    setError("");
    setBusy(true);
    captureStrip(videoUrl)
      .then((result) => {
        if (stop) return;
        setDuration(result.duration);
        setFrames(result.frames);
      })
      .catch((reason: unknown) => {
        if (stop) return;
        setError(reason instanceof Error ? reason.message : "Không lấy được khung hình.");
      })
      .finally(() => {
        if (!stop) setBusy(false);
      });
    return () => {
      stop = true;
    };
  }, [open, videoUrl]);

  useEffect(() => {
    if (!open || initialTime == null || !videoRef.current) return;
    const video = videoRef.current;
    const jump = () => {
      video.currentTime = initialTime;
    };
    if (video.readyState >= 1) jump();
    else video.addEventListener("loadedmetadata", jump, { once: true });
  }, [open, initialTime]);

  if (!open) return null;

  async function useFrame() {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    video.pause();
    try {
      const blob = await frameBlob(video);
      onUse(blob, URL.createObjectURL(blob), video.currentTime);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không chọn được ảnh bìa.");
    }
  }

  function jumpTo(time: number) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = time;
    setCurrent(time);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl border border-line bg-card p-4 shadow-xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Tùy chọn chỉnh sửa</h2>
            <p className="mt-1 text-sm text-muted">
              Xem hết video, rồi kéo thanh thời gian hoặc bấm một khung. Ảnh bìa lấy từ chính video này.
            </p>
          </div>
          <button type="button" className={quietButtonClass} onClick={onClose}>
            Đóng
          </button>
        </div>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          className="mt-4 max-h-80 w-full rounded-xl bg-black"
          playsInline
          onLoadedMetadata={(event) => {
            const next = event.currentTarget.duration;
            if (Number.isFinite(next)) setDuration(next);
          }}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onSeeked={(event) => setCurrent(event.currentTarget.currentTime)}
        />
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(current, duration || 0)}
            aria-label="Vị trí khung hình"
            className="w-full accent-pine"
            onChange={(event) => jumpTo(Number(event.target.value))}
          />
          <span className="w-24 shrink-0 text-right text-xs font-medium text-muted">
            {formatClock(current)} / {formatClock(duration)}
          </span>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {busy ? <p className="text-sm text-muted">Đang lấy khung hình...</p> : null}
          {frames.map((frame) => (
            <button
              key={frame.time}
              type="button"
              className="shrink-0 overflow-hidden rounded-lg ring-1 ring-line"
              onClick={() => jumpTo(frame.time)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frame.url} alt={`Khung ${formatClock(frame.time)}`} className="h-16 w-28 object-cover" />
            </button>
          ))}
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end">
          <button type="button" className={buttonClass} onClick={useFrame}>
            Dùng khung này
          </button>
        </div>
      </div>
    </div>
  );
}

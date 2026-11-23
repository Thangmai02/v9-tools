"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BatchRunControls, JobLogList, WaitLine } from "@/components/batch-controls";
import { cardClass, ErrorNote, formatWhen, linkClass, StatusBadge } from "@/components/ui";
import type { JobLogLine } from "@/lib/job-log";

type Job = {
  id: string;
  pageName: string;
  status: string;
  fbPostId: string | null;
  error: string | null;
  commentStatus: string;
  commentError: string | null;
  commentMessage?: string | null;
  hasCommentImage?: boolean;
  comments?: { message: string | null; hasImage: boolean }[];
  coverWarning: string | null;
  stage: string | null;
  log: JobLogLine[];
  runAt: string | null;
  finishedAt: string | null;
};

type Batch = {
  id: string;
  message: string;
  link: string | null;
  delaySeconds: number;
  commentDelaySeconds?: number;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  commentEnabled: boolean;
  commentText: string | null;
  separateComments?: boolean;
  hasCommentImage?: boolean;
  hasImage: boolean;
  hasVideo: boolean;
  hasCover: boolean;
  jobs: Job[];
};

function barClass(status: string) {
  if (status === "success") return "bg-pine";
  if (status === "failed") return "bg-danger";
  if (status === "cancelled") return "bg-line";
  if (status === "running" || status === "preparing") return "bg-pine/40";
  return "bg-amber";
}

function commentLine(job: Job) {
  if (job.commentStatus === "success") return "Fanpage đã bình luận.";
  if (job.commentStatus === "pending" || job.commentStatus === "waiting") {
    return job.stage || "Chờ đăng xong cả đợt rồi bình luận.";
  }
  if (job.commentStatus === "failed") {
    return `Bài đã đăng. Bình luận lỗi: ${job.commentError || "Facebook từ chối bình luận."}`;
  }
  return null;
}

export function BatchView({ id }: { id: string }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer = 0;

    async function load() {
      const response = await fetch(`/api/batches/${id}`);
      const data = await response.json();
      if (stop) return;
      if (!response.ok) {
        setError(data.error || "Không tải được đợt đăng.");
        return;
      }
      setBatch(data.batch);
      const commenting = data.batch.jobs.some(
        (job: { commentStatus?: string }) =>
          job.commentStatus === "pending" || job.commentStatus === "waiting",
      );
      const done =
        data.batch.status === "finished" ||
        data.batch.status === "draft" ||
        data.batch.status === "stopped";
      if (!done || commenting) timer = window.setTimeout(load, 2000);
    }

    load();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [id, reloadKey]);

  if (error) {
    return <ErrorNote>{error}</ErrorNote>;
  }
  if (!batch) {
    return <div className={`${cardClass} px-5 py-8 text-sm text-muted`}>Đang tải nhật ký...</div>;
  }

  const mediaNote = batch.hasVideo
    ? batch.hasCover
      ? " · có video và ảnh bìa"
      : " · có video"
    : batch.hasImage
      ? " · có ảnh"
      : "";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/tool" className={`${linkClass} text-sm`}>
          Về trang soạn bài
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Nhật ký đợt đăng</h1>
          <StatusBadge status={batch.status} />
        </div>
        <BatchRunControls
          id={batch.id}
          status={batch.status}
          delaySeconds={batch.delaySeconds}
          onChanged={() => setReloadKey((value) => value + 1)}
        />
        <p className="mt-2 text-sm text-muted">
          {formatWhen(batch.createdAt)} ·{" "}
          {batch.delaySeconds === 0 ? "đăng nhanh" : `giả lập đăng, chờ ${batch.delaySeconds} giây`}
          {batch.commentEnabled
            ? batch.commentDelaySeconds
              ? ` · bình luận chờ ${batch.commentDelaySeconds} giây`
              : " · bình luận nhanh"
            : ""}
          {mediaNote}
          {batch.scheduledAt ? ` · hẹn ${formatWhen(batch.scheduledAt)}` : ""}
        </p>
      </div>
      <div className={`${cardClass} p-5 sm:p-6`}>
        <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{batch.message || "(không có chữ)"}</p>
        {batch.link ? (
          <a href={batch.link} className={`${linkClass} mt-3 block break-all text-sm`}>
            {batch.link}
          </a>
        ) : null}
        {batch.commentEnabled ? (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-6 text-ink">
            <span className="font-semibold text-pine">Bình luận: </span>
            {batch.separateComments
              ? "mỗi Page một nội dung"
              : batch.commentText || (batch.hasCommentImage ? "ảnh" : "(chưa có chữ)")}
            {!batch.separateComments && batch.commentText && batch.hasCommentImage ? " · kèm ảnh" : ""}
          </p>
        ) : null}
        {batch.status === "draft" ? (
          <Link href={`/tool?draft=${batch.id}`} className={`${linkClass} mt-3 inline-block text-sm`}>
            Sửa nháp
          </Link>
        ) : null}
      </div>
      <ul className="space-y-2">
        {batch.jobs.map((job) => {
          const comment = commentLine(job);
          return (
            <li key={job.id} className={`${cardClass} overflow-hidden`}>
              <div className="flex">
                <span className={`w-1.5 shrink-0 ${barClass(job.status)}`} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{job.pageName}</p>
                    {(job.status === "pending" || job.status === "queued") && job.runAt ? (
                      <p className="mt-0.5 text-xs font-medium text-ink">
                        <WaitLine runAt={job.runAt} />
                      </p>
                    ) : job.stage ? (
                      <p className="mt-0.5 text-xs font-medium text-ink">{job.stage}</p>
                    ) : null}
                    <JobLogList lines={job.log} />
                    {job.comments && job.comments.length > 1 ? (
                      <ul className="mt-1 space-y-1 text-sm leading-5 text-muted">
                        {job.comments.map((item, index) => (
                          <li key={`${item.message ?? "anh"}-${index}`}>
                            Bình luận {index + 1}: {item.message || "ảnh"}
                            {item.message && item.hasImage ? " · kèm ảnh" : ""}
                          </li>
                        ))}
                      </ul>
                    ) : job.commentMessage || job.hasCommentImage ? (
                      <p className="mt-1 text-sm leading-5 text-muted">
                        Bình luận: {job.commentMessage || "ảnh"}
                        {job.commentMessage && job.hasCommentImage ? " · kèm ảnh" : ""}
                      </p>
                    ) : null}
                    {job.error ? <p className="mt-1 text-sm leading-5 text-danger">{job.error}</p> : null}
                    {comment ? (
                      <p
                        className={`mt-1 text-sm leading-5 ${
                          job.commentStatus === "failed" ? "text-danger" : "text-muted"
                        }`}
                      >
                        {comment}
                      </p>
                    ) : null}
                    {job.coverWarning ? (
                      <p className="mt-1 text-sm leading-5 text-amber">{job.coverWarning}</p>
                    ) : null}
                    {(job.status === "pending" || job.status === "queued") && job.runAt ? (
                      <p className="mt-1 text-xs text-muted">Dự kiến {formatWhen(job.runAt)}</p>
                    ) : null}
                    {job.finishedAt ? (
                      <p className="mt-1 text-xs text-muted">{formatWhen(job.finishedAt)}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={job.status} />
                    {job.fbPostId ? (
                      <a
                        href={`https://www.facebook.com/${job.fbPostId}`}
                        className={`${linkClass} text-sm`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem bài
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

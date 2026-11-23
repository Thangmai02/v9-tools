import { prisma } from "@/lib/db";
import { userHasAdminRole } from "@/lib/admin";
import { memberHasPro, requireMemberPage } from "@/lib/auth";
import { resolvePageOwnerIds } from "@/lib/facebook-keys";
import { parseStoredComments } from "@/lib/comment-items";
import { parseJobLog } from "@/lib/job-log";
import { Composer, type ComposerDraft } from "@/components/composer";
import { ToolShell } from "@/components/tool-shell";

export const dynamic = "force-dynamic";

function draftComments(
  job: { id: string; commentItems: string | null; commentMessage: string | null; commentImagePath: string | null } | null | undefined,
  batchId: string,
  fallbackText: string | null,
  fallbackImage: string | null,
) {
  const stored = parseStoredComments(job?.commentItems);
  if (stored.length) {
    return stored.map((item, index) => ({
      text: item.message ?? "",
      imageUrl: item.imagePath
        ? `/api/batches/${batchId}/file?which=job-comment&job=${job?.id}&index=${index}`
        : null,
      storedIndex: index,
    }));
  }
  if ((job?.commentMessage ?? fallbackText) || (job?.commentImagePath ?? fallbackImage)) {
    const imagePath = job?.commentImagePath ?? fallbackImage;
    return [
      {
        text: job?.commentMessage ?? fallbackText ?? "",
        imageUrl: imagePath
          ? job?.commentImagePath
            ? `/api/batches/${batchId}/file?which=job-comment&job=${job.id}`
            : `/api/batches/${batchId}/file?which=comment`
          : null,
        storedIndex: 0,
      },
    ];
  }
  return [];
}

function counts(jobs: { status: string }[]) {
  return {
    success: jobs.filter((job) => job.status === "success").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    pending: jobs.filter((job) => job.status === "pending" || job.status === "queued").length,
    running: jobs.filter((job) => job.status === "running").length,
    total: jobs.length,
  };
}

export default async function ToolPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; saved?: string }>;
}) {
  const user = await requireMemberPage();
  const query = await searchParams;
  const isPro = await memberHasPro(user.id, user.plan);
  const isAdmin = userHasAdminRole(user);

  const ownerIds = await resolvePageOwnerIds(user.id);
  const [pages, accounts, batches] = await Promise.all([
    ownerIds.length
      ? prisma.page.findMany({
          where: { account: { userId: { in: ownerIds } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    ownerIds.length
      ? prisma.facebookAccount.findMany({
          where: { userId: { in: ownerIds } },
          select: { name: true },
        })
      : Promise.resolve([]),
    prisma.postBatch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        jobs: {
          select: {
            status: true,
            pageName: true,
            fbPageId: true,
            position: true,
            error: true,
            fbPostId: true,
            commentStatus: true,
            commentError: true,
            reactionStatus: true,
            stage: true,
            log: true,
            runAt: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);

  const facebookName = isAdmin
    ? accounts.length
      ? `Admin · ${accounts.length} mã khóa`
      : null
    : accounts[0]?.name ?? null;
  let initialDraft: ComposerDraft | null = null;
  if (query.draft) {
    const row = await prisma.postBatch.findFirst({
      where: { id: query.draft, userId: user.id, status: "draft" },
      include: { jobs: true },
    });
    if (row) {
      initialDraft = {
        id: row.id,
        message: row.message,
        link: row.link ?? "",
        delaySeconds: row.delaySeconds,
        commentDelaySeconds: row.commentDelaySeconds,
        commentEnabled: row.commentEnabled,
        reactionEnabled: row.reactionEnabled,
        reactionType:
          row.reactionType === "LOVE" || row.reactionType === "CARE" ? row.reactionType : "LIKE",
        commentText: row.commentText ?? "",
        separateComments: row.separateComments,
        commentImageUrl: row.commentImagePath ? `/api/batches/${row.id}/file?which=comment` : null,
        comments: draftComments(row.separateComments ? null : row.jobs[0], row.id, row.commentText, row.commentImagePath),
        pageComments: row.jobs
          .map((job) => {
            const page = pages.find((item) => item.pageId === job.fbPageId);
            if (!page) return null;
            return {
              pageId: page.id,
              comments: draftComments(job, row.id, job.commentMessage, job.commentImagePath),
            };
          })
          .filter((item): item is { pageId: string; comments: ComposerDraft["comments"] } => Boolean(item)),
        scheduledAt: row.scheduledAt?.toISOString() ?? null,
        pageIds: row.jobs
          .map((job) => pages.find((page) => page.pageId === job.fbPageId)?.id)
          .filter((id): id is string => Boolean(id)),
        imageUrl: row.imagePath ? `/api/batches/${row.id}/file?which=image` : null,
        videoUrl: row.videoPath ? `/api/batches/${row.id}/file?which=video` : null,
        coverUrl: row.coverPath ? `/api/batches/${row.id}/file?which=cover` : null,
      };
    }
  }

  const recent = batches.filter((batch) => batch.status !== "draft").slice(0, 1);

  return (
    <ToolShell
      email={user.email}
      name={user.name}
      avatarUrl={user.avatarUrl}
      pro={isPro}
      admin={isAdmin}
      active="post"
    >
      <Composer
        key={initialDraft?.id ?? "new"}
        facebookName={facebookName}
        pages={pages.map((page) => ({
          id: page.id,
          name: page.name,
          category: page.category,
          pictureUrl: page.pictureUrl,
        }))}
        batches={recent.map((batch) => ({
          id: batch.id,
          message: batch.message,
          status: batch.status,
          createdAt: batch.createdAt.toISOString(),
          completedAt: batch.completedAt?.toISOString() ?? null,
          delaySeconds: batch.delaySeconds,
          pages: batch.jobs.map((job) => {
            const page = pages.find((item) => item.pageId === job.fbPageId);
            return {
              id: page?.id ?? job.fbPageId,
              name: job.pageName,
              pictureUrl: page?.pictureUrl ?? null,
              status: job.status,
              error: job.error,
              fbPostId: job.fbPostId,
              commentStatus: job.commentStatus,
              commentError: job.commentError,
              reactionStatus: job.reactionStatus,
              stage: job.stage,
              log: parseJobLog(job.log).slice(-12),
              runAt: job.runAt?.toISOString() ?? null,
              startedAt: job.startedAt?.toISOString() ?? null,
              finishedAt: job.finishedAt?.toISOString() ?? null,
              message: batch.message,
            };
          }),
          counts: counts(batch.jobs),
        }))}
        initialDraft={initialDraft}
        notice={query.saved === "1" ? "Đã lưu nháp." : null}
      />
    </ToolShell>
  );
}

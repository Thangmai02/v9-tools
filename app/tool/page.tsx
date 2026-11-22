import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { userHasAdminRole } from "@/lib/admin";
import { memberHasPro, resolveMember } from "@/lib/auth";
import { resolvePageSourceUserId } from "@/lib/facebook-keys";
import { parseStoredComments } from "@/lib/comment-items";
import { Composer, type ComposerDraft } from "@/components/composer";
import { ToolShell } from "@/components/tool-shell";
import { Waiting } from "@/components/waiting";

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
    pending: jobs.filter((job) => job.status === "pending").length,
    running: jobs.filter((job) => job.status === "running").length,
    total: jobs.length,
  };
}

export default async function ToolPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; saved?: string }>;
}) {
  const user = await resolveMember();
  if (!user) redirect("/login");
  const query = await searchParams;
  const isPro = await memberHasPro(user.id, user.plan);
  if (!isPro) {
    return (
      <Waiting
        name={user.name}
        email={user.email}
        avatarUrl={user.avatarUrl}
        admin={userHasAdminRole(user)}
      />
    );
  }

  const sourceUserId = await resolvePageSourceUserId(user.id);
  const [account, batches] = await Promise.all([
    sourceUserId
      ? prisma.facebookAccount.findUnique({
          where: { userId: sourceUserId },
          include: { pages: { orderBy: { name: "asc" } } },
        })
      : Promise.resolve(null),
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
            runAt: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);

  const pages = account?.pages ?? [];
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
      pro
      admin={userHasAdminRole(user)}
      active="post"
    >
      <Composer
        key={initialDraft?.id ?? "new"}
        facebookName={account?.name ?? null}
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

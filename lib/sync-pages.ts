import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { listManagedPages } from "@/lib/facebook";

export async function connectFacebook(input: {
  userId: string;
  token: string;
  fbUserId: string;
  name: string;
  expiresAt: Date | null;
}) {
  await prisma.facebookAccount.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      fbUserId: input.fbUserId,
      name: input.name,
      userAccessTokenEnc: encrypt(input.token),
      tokenExpiresAt: input.expiresAt,
    },
    update: {
      fbUserId: input.fbUserId,
      name: input.name,
      userAccessTokenEnc: encrypt(input.token),
      tokenExpiresAt: input.expiresAt,
      connectedAt: new Date(),
    },
  });
  await syncPages(input.userId);
}

export async function syncPages(userId: string) {
  const account = await prisma.facebookAccount.findUnique({
    where: { userId },
  });
  if (!account) {
    throw new Error("Chưa kết nối Facebook.");
  }

  const remote = await listManagedPages(decrypt(account.userAccessTokenEnc));
  const seen = new Set<string>();

  for (const page of remote) {
    if (!page.access_token) continue;
    seen.add(page.id);
    const data = {
      name: page.name?.trim() || page.id,
      category: page.category ?? null,
      pictureUrl: page.picture?.data?.url ?? null,
      accessTokenEnc: encrypt(page.access_token),
    };
    await prisma.page.upsert({
      where: {
        facebookAccountId_pageId: {
          facebookAccountId: account.id,
          pageId: page.id,
        },
      },
      create: {
        facebookAccountId: account.id,
        pageId: page.id,
        ...data,
      },
      update: data,
    });
  }

  const existing = await prisma.page.findMany({
    where: { facebookAccountId: account.id },
    select: { id: true, pageId: true },
  });
  const stale = existing.filter((page) => !seen.has(page.pageId)).map((page) => page.id);
  if (stale.length > 0) {
    await prisma.page.deleteMany({ where: { id: { in: stale } } });
  }

  return seen.size;
}

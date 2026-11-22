import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { connectFacebook } from "@/lib/sync-pages";
import { getMe } from "@/lib/facebook";
import { grantPro } from "@/lib/license";

export const KEY_COLORS = [
  "#0f6e56",
  "#2563eb",
  "#d97706",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#db2777",
] as const;

async function ensureKeyHost(keyId: string) {
  const email = `key-${keyId}@local`;
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: `Mã ${keyId.slice(-4)}`,
        email,
        passwordHash: "local-key-host",
        role: "member",
        plan: "free",
      },
    });
  }
  const license = await prisma.licenseKey.findFirst({
    where: { userId: user.id, status: "active" },
  });
  if (user.plan !== "pro" || !license) {
    await grantPro(user.id);
  }
  return user;
}

export async function listFacebookKeys() {
  return prisma.facebookKey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true } },
    },
  });
}

export async function createFacebookKey(input: {
  label: string;
  color: string;
  token: string;
}) {
  const label = input.label.trim() || "Mã mới";
  const color = KEY_COLORS.includes(input.color as (typeof KEY_COLORS)[number])
    ? input.color
    : KEY_COLORS[0];
  const token = input.token.trim();
  if (token.length < 20) throw new Error("Dán user access token hợp lệ.");

  const me = await getMe(token);
  const keyId = `fk${randomBytes(12).toString("hex")}`;
  const host = await ensureKeyHost(keyId);
  await prisma.user.update({
    where: { id: host.id },
    data: { name: label },
  });

  await connectFacebook({
    userId: host.id,
    token,
    fbUserId: me.id,
    name: me.name || "Facebook",
    expiresAt: null,
  });

  const pageCount = await prisma.page.count({
    where: { account: { userId: host.id } },
  });

  return prisma.facebookKey.create({
    data: {
      id: keyId,
      label,
      color,
      tokenEnc: encrypt(token),
      fbUserId: me.id,
      name: me.name || "Facebook",
      hostUserId: host.id,
      pageCount,
    },
  });
}

export async function deleteFacebookKey(id: string) {
  const key = await prisma.facebookKey.findUnique({ where: { id } });
  if (!key) throw new Error("Không thấy mã khóa.");
  await prisma.user.updateMany({
    where: { facebookKeyId: id },
    data: { facebookKeyId: null },
  });
  await prisma.facebookAccount.deleteMany({ where: { userId: key.hostUserId } });
  await prisma.user.deleteMany({ where: { id: key.hostUserId } });
  await prisma.facebookKey.delete({ where: { id } });
}

export async function assignFacebookKey(userId: string, facebookKeyId: string | null) {
  if (facebookKeyId) {
    const key = await prisma.facebookKey.findUnique({ where: { id: facebookKeyId } });
    if (!key) throw new Error("Không thấy mã khóa.");
  }
  return prisma.user.update({
    where: { id: userId },
    data: { facebookKeyId },
  });
}

export async function resolvePageSourceUserId(memberId: string) {
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    include: { facebookKey: true },
  });
  if (member?.facebookKey?.hostUserId) return member.facebookKey.hostUserId;

  // Tạm giữ bàn cũ nếu chưa gán mã mới.
  const desk = await prisma.user.findUnique({ where: { email: "ban@local" } });
  const hasDeskPages = desk
    ? await prisma.page.count({ where: { account: { userId: desk.id } } })
    : 0;
  if (desk && hasDeskPages > 0) return desk.id;
  return null;
}

export function maskToken() {
  return "••••••••••••";
}

export function revealHint(tokenEnc: string) {
  try {
    const plain = decrypt(tokenEnc);
    if (plain.length <= 10) return plain;
    return `${plain.slice(0, 6)}…${plain.slice(-4)}`;
  } catch {
    return "(không đọc được)";
  }
}

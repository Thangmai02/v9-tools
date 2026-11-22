import { randomBytes } from "crypto";
import { userHasAdminRole } from "@/lib/admin";
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Không thấy tài khoản.");
    const license = await prisma.licenseKey.findFirst({
      where: { userId, status: "active" },
    });
    const isPro = user.plan === "pro" && Boolean(license);
    if (!isPro && !userHasAdminRole(user)) {
      throw new Error("Chỉ gán mã Facebook cho tài khoản đã nâng Pro.");
    }
  }
  return prisma.user.update({
    where: { id: userId },
    data: { facebookKeyId },
  });
}

/**
 * Host user chứa sở hữu Page Facebook mà member được dùng.
 * Admin: mọi mã khóa. Tài khoản thường: chỉ mã admin đã gán.
 */
export async function resolvePageOwnerIds(memberId: string) {
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    include: { facebookKey: true },
  });
  if (!member) return [] as string[];

  if (userHasAdminRole(member)) {
    const keys = await prisma.facebookKey.findMany({ select: { hostUserId: true } });
    return [...new Set(keys.map((key) => key.hostUserId))];
  }

  if (member.facebookKey?.hostUserId) return [member.facebookKey.hostUserId];
  return [];
}

/** Giữ API cũ: một host (admin lấy mã mới nhất nếu chưa gán). */
export async function resolvePageSourceUserId(memberId: string) {
  const owners = await resolvePageOwnerIds(memberId);
  return owners[0] ?? null;
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

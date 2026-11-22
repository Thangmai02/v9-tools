import { prisma } from "@/lib/db";
import { grantPro } from "@/lib/license";

export function adminEmails() {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export function userHasAdminRole(user: { email: string; role: string } | null | undefined) {
  if (!user) return false;
  return user.role === "admin" || isAdminEmail(user.email);
}

/** Admin (email hoặc role) → luôn role admin + Pro (toàn quyền app). */
export async function ensureAdminPrivileges(user: {
  id: string;
  email: string;
  role: string;
  plan: string;
}) {
  if (!userHasAdminRole(user)) return false;
  if (user.role !== "admin") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
    });
  }
  const license = await prisma.licenseKey.findFirst({
    where: { userId: user.id, status: "active" },
  });
  if (user.plan !== "pro" || !license) {
    await grantPro(user.id);
  }
  return true;
}

/** Admin email → role admin + Pro. */
export async function syncAdminRoleByEmail(userId: string, email: string) {
  if (!isAdminEmail(email)) return false;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  return ensureAdminPrivileges(user);
}

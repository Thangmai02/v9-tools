import { prisma } from "@/lib/db";

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

export async function syncAdminRoleByEmail(userId: string, email: string) {
  if (!isAdminEmail(email)) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { role: "admin" },
  });
  return true;
}

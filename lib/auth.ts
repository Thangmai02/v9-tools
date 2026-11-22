import bcrypt from "bcryptjs";
import { syncAdminRoleByEmail, userHasAdminRole } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { clearSessionCookie, readSession } from "@/lib/session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function resolveMember() {
  const session = await readSession();
  if (!session || session.role !== "member") return null;
  let user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    await clearSessionCookie();
    return null;
  }
  if (user.role !== "admin" && (await syncAdminRoleByEmail(user.id, user.email))) {
    user = { ...user, role: "admin" };
  }
  return user;
}

export async function memberHasPro(userId: string, plan: string) {
  if (plan !== "pro") return false;
  const license = await prisma.licenseKey.findFirst({
    where: { userId, status: "active" },
  });
  return Boolean(license);
}

export async function requireProUser() {
  const user = await resolveMember();
  if (!user) {
    return { ok: false as const, status: 401, error: "Bạn cần đăng nhập." };
  }
  if (!(await memberHasPro(user.id, user.plan))) {
    return {
      ok: false as const,
      status: 403,
      error: "Tài khoản chưa được nâng Pro.",
    };
  }
  return { ok: true as const, user };
}

export async function requireAdmin() {
  const session = await readSession();
  if (!session) {
    return {
      ok: false as const,
      status: 401,
      error: "Bạn cần đăng nhập admin.",
    };
  }
  if (session.role === "admin") {
    return { ok: true as const };
  }
  if (session.role === "member") {
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (user && userHasAdminRole(user)) {
      if (user.role !== "admin") {
        await syncAdminRoleByEmail(user.id, user.email);
      }
      return { ok: true as const, user };
    }
  }
  return {
    ok: false as const,
    status: 401,
    error: "Bạn cần đăng nhập admin.",
  };
}

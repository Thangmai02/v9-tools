import { NextResponse } from "next/server";
import { syncAdminRoleByEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { sealSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-token";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : null;

  if (!user) {
    return NextResponse.json(
      { error: "Email hoặc mật khẩu không đúng." },
      { status: 401 },
    );
  }
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "Tài khoản này dùng Đăng nhập bằng Gmail." },
      { status: 401 },
    );
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Email hoặc mật khẩu không đúng." },
      { status: 401 },
    );
  }

  await syncAdminRoleByEmail(user.id, user.email);

  const token = await sealSession({ role: "member", sub: user.id });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

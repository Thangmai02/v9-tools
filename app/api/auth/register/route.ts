import { NextResponse } from "next/server";
import { isAdminEmail, syncAdminRoleByEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sealSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-token";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
  } | null;
  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: "Tên cần từ 2 đến 80 ký tự." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 100) {
    return NextResponse.json(
      { error: "Mật khẩu cần từ 8 đến 100 ký tự." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Email này đã có tài khoản." },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: isAdminEmail(email) ? "admin" : "member",
      plan: "free",
    },
  });

  if (isAdminEmail(email)) {
    await syncAdminRoleByEmail(user.id, email);
  }

  const token = await sealSession({ role: "member", sub: user.id });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { sealSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-token";

function sameText(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Chưa cấu hình ADMIN_PASSWORD." },
      { status: 500 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;
  if (!body?.password || !sameText(body.password, expected)) {
    return NextResponse.json({ error: "Mật khẩu admin không đúng." }, { status: 401 });
  }
  const token = await sealSession({ role: "admin" });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

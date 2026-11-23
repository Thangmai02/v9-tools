import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const login = new URL("/login?expired=1", request.url);
  return clearSession(NextResponse.redirect(login));
}

export async function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}

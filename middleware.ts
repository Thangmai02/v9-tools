import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { openSession, SESSION_COOKIE } from "@/lib/session-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/admin/login" ||
    pathname === "/api/facebook/callback" ||
    pathname === "/admin"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const session = await openSession(token);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Phiên đăng nhập không còn hiệu lực." },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/tool",
    "/batches/:path*",
    "/admin",
    "/api/admin/:path*",
    "/api/notices",
    "/api/pages",
    "/api/pages/:path*",
    "/api/facebook/:path*",
  ],
};

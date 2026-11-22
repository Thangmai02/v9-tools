import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireProUser } from "@/lib/auth";
import { exchangeCode, exchangeLongLived, getMe } from "@/lib/facebook";
import { absoluteUrl } from "@/lib/request-origin";
import { connectFacebook } from "@/lib/sync-pages";

function finish(request: Request, path: string) {
  const response = NextResponse.redirect(absoluteUrl(request, path));
  response.cookies.set("fb_oauth_state", "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const gate = await requireProUser();
  if (!gate.ok) return finish(request, "/login");

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return finish(request, "/?fb=denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = (await cookies()).get("fb_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return finish(
      request,
      `/?fb=error&msg=${encodeURIComponent("Phiên kết nối Facebook không hợp lệ. Thử lại.")}`,
    );
  }

  try {
    const shortLived = await exchangeCode(code);
    const longLived = await exchangeLongLived(shortLived.access_token);
    const me = await getMe(longLived.access_token);
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : null;
    await connectFacebook({
      userId: gate.user.id,
      token: longLived.access_token,
      fbUserId: me.id,
      name: me.name || "Facebook",
      expiresAt,
    });
    return finish(request, "/?fb=ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không kết nối được Facebook.";
    return finish(
      request,
      `/?fb=error&msg=${encodeURIComponent(message.slice(0, 180))}`,
    );
  }
}

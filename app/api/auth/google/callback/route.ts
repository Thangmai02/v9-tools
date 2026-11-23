import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminEmail, syncAdminRoleByEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { exchangeGoogleCode, fetchGoogleProfile } from "@/lib/google-auth";
import { absoluteUrl } from "@/lib/request-origin";
import { sealSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-token";

function finish(request: Request, path: string) {
  const response = NextResponse.redirect(absoluteUrl(request, path));
  response.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state");
  const oauthError = incoming.searchParams.get("error");
  if (oauthError) {
    return finish(request, `/login?google=denied`);
  }

  const expected = (await cookies()).get("google_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return finish(request, `/login?google=invalid`);
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const profile = await fetchGoogleProfile(accessToken);
    const role = isAdminEmail(profile.email) ? "admin" : "member";

    let user =
      (await prisma.user.findUnique({ where: { googleId: profile.googleId } })) ||
      (await prisma.user.findUnique({ where: { email: profile.email } }));

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          name: user.name || profile.name,
          avatarUrl: profile.picture ?? user.avatarUrl,
          role: role === "admin" || user.role === "admin" ? "admin" : user.role,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: profile.name,
          email: profile.email,
          googleId: profile.googleId,
          avatarUrl: profile.picture,
          passwordHash: null,
          role,
          plan: "free",
        },
      });
    }

    if (isAdminEmail(profile.email)) {
      await syncAdminRoleByEmail(user.id, profile.email);
    }

    const token = await sealSession({ role: "member", sub: user.id });
    const response = finish(request, "/tool?welcome=1");
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[google-oauth]", message);
    return finish(request, `/login?google=failed`);
  }
}

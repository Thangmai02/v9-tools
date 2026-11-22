import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireProUser } from "@/lib/auth";
import { facebookAuthUrl } from "@/lib/facebook";

export async function GET() {
  const gate = await requireProUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const state = randomBytes(16).toString("hex");
  let authUrl: string;
  try {
    authUrl = facebookAuthUrl(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chưa cấu hình Facebook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("fb_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}

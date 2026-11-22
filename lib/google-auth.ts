function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu ${name} trong cấu hình.`);
  return value;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function googleRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    "http://localhost:3000/api/auth/google/callback"
  );
}

export function googleAuthUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requiredEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google từ chối mã đăng nhập.");
  }
  return data.access_token;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.sub || !data.email) {
    throw new Error(data.error_description || data.error || "Không lấy được hồ sơ Google.");
  }
  const verified = data.email_verified === true || data.email_verified === "true";
  if (!verified) {
    throw new Error("Email Gmail chưa được Google xác minh.");
  }
  return {
    googleId: data.sub,
    email: data.email.trim().toLowerCase(),
    name: (data.name || data.email.split("@")[0] || "Người dùng").trim().slice(0, 80),
    picture: data.picture ?? null,
  };
}

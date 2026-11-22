import { GRAPH, GRAPH_VERSION, facebookEnv, graphRequest } from "@/lib/graph";

export type RemotePage = {
  id: string;
  name?: string;
  access_token?: string;
  category?: string;
  picture?: { data?: { url?: string } };
};

export function facebookAuthUrl(state: string) {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", facebookEnv("FACEBOOK_APP_ID"));
  url.searchParams.set("redirect_uri", facebookEnv("FACEBOOK_REDIRECT_URI"));
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    "pages_show_list,pages_manage_posts,pages_read_engagement",
  );
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function exchangeCode(code: string) {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", facebookEnv("FACEBOOK_APP_ID"));
  url.searchParams.set("client_secret", facebookEnv("FACEBOOK_APP_SECRET"));
  url.searchParams.set("redirect_uri", facebookEnv("FACEBOOK_REDIRECT_URI"));
  url.searchParams.set("code", code);
  return graphRequest(url.toString()) as Promise<{
    access_token: string;
    expires_in?: number;
  }>;
}

export async function exchangeLongLived(shortToken: string) {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", facebookEnv("FACEBOOK_APP_ID"));
  url.searchParams.set("client_secret", facebookEnv("FACEBOOK_APP_SECRET"));
  url.searchParams.set("fb_exchange_token", shortToken);
  return graphRequest(url.toString()) as Promise<{
    access_token: string;
    expires_in?: number;
  }>;
}

export async function getMe(token: string) {
  const url = new URL(`${GRAPH}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", token);
  return graphRequest(url.toString()) as Promise<{ id: string; name: string }>;
}

export async function listManagedPages(userToken: string) {
  const pages: RemotePage[] = [];
  let next: string | null =
    `${GRAPH}/me/accounts?fields=id,name,access_token,category,picture{url}&limit=50`;

  for (let hop = 0; hop < 20 && next; hop += 1) {
    const url = new URL(next);
    if (!url.searchParams.has("access_token")) {
      url.searchParams.set("access_token", userToken);
    }
    const body = await graphRequest(url.toString());
    const chunk = (body.data as RemotePage[] | undefined) ?? [];
    pages.push(...chunk);
    next = (body.paging as { next?: string } | undefined)?.next ?? null;
  }

  return pages.filter((page) => page.id && page.access_token);
}

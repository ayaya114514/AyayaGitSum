import { NextResponse } from "next/server";

import {
  buildGitHubAuthorizeUrl,
  createOAuthState,
  GITHUB_OAUTH_RETURN_TO_COOKIE,
  GITHUB_OAUTH_STATE_COOKIE,
  getGitHubOAuthConfig,
  sanitizeReturnTo,
} from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = getGitHubOAuthConfig();
  const returnTo = sanitizeReturnTo(url.searchParams.get("next"));

  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(new URL(returnTo, url));
  }

  const state = createOAuthState();
  const redirect = NextResponse.redirect(
    buildGitHubAuthorizeUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      scope: "read:user",
    }),
  );

  redirect.cookies.set({
    name: GITHUB_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(url),
    path: "/",
    maxAge: 60 * 10,
  });
  redirect.cookies.set({
    name: GITHUB_OAUTH_RETURN_TO_COOKIE,
    value: returnTo,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(url),
    path: "/",
    maxAge: 60 * 10,
  });

  return redirect;
}

function isSecure(url: URL) {
  return url.protocol === "https:";
}

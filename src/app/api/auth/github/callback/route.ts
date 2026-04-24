import { NextResponse } from "next/server";

import {
  encryptSession,
  GITHUB_OAUTH_RETURN_TO_COOKIE,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_SESSION_COOKIE,
  getGitHubOAuthConfig,
  sanitizeReturnTo,
} from "@/lib/auth";
import { siteConfig } from "@/lib/site";

type GitHubOAuthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubViewerResponse = {
  login: string;
  avatar_url: string;
  name: string | null;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const config = getGitHubOAuthConfig();
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const cookieStore = request.headers.get("cookie");
  const stateCookie = getCookieValue(cookieStore, GITHUB_OAUTH_STATE_COOKIE);
  const returnTo = sanitizeReturnTo(
    getCookieValue(cookieStore, GITHUB_OAUTH_RETURN_TO_COOKIE),
  );

  if (
    error ||
    !code ||
    !state ||
    !stateCookie ||
    state !== stateCookie ||
    !config.clientId ||
    !config.clientSecret ||
    !config.sessionSecret
  ) {
    return clearAuthCookies(
      NextResponse.redirect(new URL(returnTo, requestUrl)),
      requestUrl,
    );
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      state,
    }),
  });

  const tokenPayload = (await tokenResponse.json()) as GitHubOAuthTokenResponse;

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return clearAuthCookies(
      NextResponse.redirect(new URL(returnTo, requestUrl)),
      requestUrl,
    );
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": siteConfig.githubApiVersion,
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return clearAuthCookies(
      NextResponse.redirect(new URL(returnTo, requestUrl)),
      requestUrl,
    );
  }

  const user = (await userResponse.json()) as GitHubViewerResponse;
  const sessionValue = await encryptSession(
    {
      accessToken: tokenPayload.access_token,
      login: user.login,
      avatarUrl: user.avatar_url,
      name: user.name,
    },
    config.sessionSecret,
  );
  const response = NextResponse.redirect(new URL(returnTo, requestUrl));

  response.cookies.set({
    name: GITHUB_SESSION_COOKIE,
    value: sessionValue,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(requestUrl),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return clearAuthCookies(response, requestUrl);
}

function clearAuthCookies(response: NextResponse, url: URL) {
  response.cookies.set({
    name: GITHUB_OAUTH_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(url),
    path: "/",
    maxAge: 0,
  });
  response.cookies.set({
    name: GITHUB_OAUTH_RETURN_TO_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(url),
    path: "/",
    maxAge: 0,
  });

  return response;
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const entry of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = entry.trim().split("=");

    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function isSecure(url: URL) {
  return url.protocol === "https:";
}

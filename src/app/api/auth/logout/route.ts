import { NextResponse } from "next/server";

import {
  GITHUB_OAUTH_RETURN_TO_COOKIE,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_SESSION_COOKIE,
  sanitizeReturnTo,
} from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(returnTo, url));

  for (const cookieName of [
    GITHUB_SESSION_COOKIE,
    GITHUB_OAUTH_STATE_COOKIE,
    GITHUB_OAUTH_RETURN_TO_COOKIE,
  ]) {
    response.cookies.set({
      name: cookieName,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure(url),
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

function isSecure(url: URL) {
  return url.protocol === "https:";
}

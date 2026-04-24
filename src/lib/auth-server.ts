import { cookies } from "next/headers";

import {
  GITHUB_SESSION_COOKIE,
  getGitHubOAuthConfig,
  readGitHubSession,
  summarizeGitHubAuthState,
} from "@/lib/auth";

export async function getGitHubSessionFromCookies() {
  const cookieStore = cookies();
  const config = getGitHubOAuthConfig();

  return readGitHubSession(
    cookieStore.get(GITHUB_SESSION_COOKIE)?.value,
    config.sessionSecret,
  );
}

export async function getGitHubAuthStateFromCookies() {
  const config = getGitHubOAuthConfig();
  const session = await getGitHubSessionFromCookies();

  return summarizeGitHubAuthState({
    session,
    serverToken: config.serverToken,
    oauthClientId: config.clientId,
    oauthClientSecret: config.clientSecret,
  });
}

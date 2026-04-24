import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGitHubAuthorizeUrl,
  decryptSession,
  encryptSession,
  resolveGitHubRequestAuth,
  sanitizeReturnTo,
  summarizeGitHubAuthState,
  toGitHubApiHeaders,
} from "@/lib/auth";

const SECRET = "01234567890123456789012345678901";

test("resolveGitHubRequestAuth prefers signed-in user token", () => {
  const result = resolveGitHubRequestAuth({
    userToken: "gho_user",
    oauthClientId: "Iv1.app",
    oauthClientSecret: "secret",
  });

  assert.equal(result.mode, "user-token");
  assert.equal(result.token, "gho_user");
});

test("resolveGitHubRequestAuth falls back to server token before oauth app auth", () => {
  const result = resolveGitHubRequestAuth({
    serverToken: "ghp_server",
    oauthClientId: "Iv1.app",
    oauthClientSecret: "secret",
  });

  assert.equal(result.mode, "server-token");
  assert.equal(result.token, "ghp_server");
});

test("resolveGitHubRequestAuth falls back to oauth app auth", () => {
  const result = resolveGitHubRequestAuth({
    oauthClientId: "Iv1.app",
    oauthClientSecret: "secret",
  });

  assert.equal(result.mode, "oauth-app");
});

test("resolveGitHubRequestAuth falls back to anonymous mode", () => {
  const result = resolveGitHubRequestAuth({});

  assert.equal(result.mode, "anonymous");
});

test("session payload round-trips through encryption", async () => {
  const encrypted = await encryptSession(
    { accessToken: "gho_test", login: "octocat" },
    SECRET,
  );
  const session = await decryptSession(encrypted, SECRET);

  assert.equal(session?.login, "octocat");
  assert.equal(session?.accessToken, "gho_test");
});

test("buildGitHubAuthorizeUrl includes state and redirect uri", () => {
  const url = buildGitHubAuthorizeUrl({
    clientId: "Iv1.app",
    redirectUri: "http://localhost:3000/api/auth/github/callback",
    state: "state123",
  });

  assert.match(url.toString(), /client_id=Iv1\.app/);
  assert.match(url.toString(), /state=state123/);
  assert.match(url.toString(), /redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fgithub%2Fcallback/);
  assert.match(url.toString(), /scope=read%3Auser/);
});

test("summarizeGitHubAuthState reports user-token mode when session exists", () => {
  const summary = summarizeGitHubAuthState({
    session: { accessToken: "gho_user", login: "octocat" },
    oauthClientId: "Iv1.app",
    oauthClientSecret: "secret",
  });

  assert.equal(summary.mode, "user-token");
  assert.equal(summary.canLogin, true);
  assert.equal(summary.usesSharedQuota, false);
  assert.equal(summary.session?.login, "octocat");
});

test("summarizeGitHubAuthState reports oauth app mode for shared public quota", () => {
  const summary = summarizeGitHubAuthState({
    oauthClientId: "Iv1.app",
    oauthClientSecret: "secret",
  });

  assert.equal(summary.mode, "oauth-app");
  assert.equal(summary.canLogin, true);
  assert.equal(summary.usesSharedQuota, true);
  assert.equal(summary.session, null);
});

test("toGitHubApiHeaders uses bearer auth for token-based modes", () => {
  const headers = toGitHubApiHeaders({
    mode: "server-token",
    token: "ghp_server",
  });

  assert.equal(headers.Authorization, "Bearer ghp_server");
});

test("toGitHubApiHeaders uses basic auth for oauth app mode", () => {
  const headers = toGitHubApiHeaders({
    mode: "oauth-app",
    basicAuth: "Basic abc123",
  });

  assert.equal(headers.Authorization, "Basic abc123");
});

test("toGitHubApiHeaders omits authorization for anonymous mode", () => {
  const headers = toGitHubApiHeaders({
    mode: "anonymous",
  });

  assert.equal(headers.Authorization, undefined);
});

test("sanitizeReturnTo keeps safe in-app paths", () => {
  assert.equal(sanitizeReturnTo("/user/octocat"), "/user/octocat");
});

test("sanitizeReturnTo rejects external redirects", () => {
  assert.equal(sanitizeReturnTo("https://evil.example"), "/");
  assert.equal(sanitizeReturnTo("//evil.example"), "/");
  assert.equal(sanitizeReturnTo("javascript:alert(1)"), "/");
});

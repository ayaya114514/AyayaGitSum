import test from "node:test";
import assert from "node:assert/strict";

import { GitHubApiError } from "@/lib/github";
import { getStatusNotice } from "@/lib/status-notices";

test("rate limit without GitHub token explains anonymous quota exhaustion", () => {
  const error = new GitHubApiError("API rate limit exceeded", {
    kind: "rate-limit",
    status: 403,
    source: "rest",
    resetAt: "2026-04-23T11:17:24.000Z",
  });

  const notice = getStatusNotice(error, { hasGithubToken: false });

  assert.equal(notice.title, "GitHub 匿名额度已耗尽");
  assert.match(notice.description, /GITHUB_TOKEN/);
  assert.match(notice.description, /匿名/);
});

test("rate limit with oauth app auth explains shared app quota exhaustion", () => {
  const error = new GitHubApiError("API rate limit exceeded", {
    kind: "rate-limit",
    status: 403,
    source: "graphql",
    resetAt: "2026-04-23T11:17:24.000Z",
  });

  const notice = getStatusNotice(error, { authMode: "oauth-app" });

  assert.equal(notice.title, "GitHub 应用公共额度已耗尽");
  assert.match(notice.description, /OAuth App/i);
  assert.match(notice.description, /共享/);
});

test("rate limit with signed-in user token explains personal quota exhaustion", () => {
  const error = new GitHubApiError("API rate limit exceeded", {
    kind: "rate-limit",
    status: 403,
    source: "graphql",
    resetAt: "2026-04-23T11:17:24.000Z",
  });

  const notice = getStatusNotice(error, { authMode: "user-token" });

  assert.equal(notice.title, "当前登录账号的 GitHub 配额已耗尽");
  assert.match(notice.description, /后重试|稍后重试/);
});

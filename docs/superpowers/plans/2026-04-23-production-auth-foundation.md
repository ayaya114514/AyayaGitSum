# GitPulse Production Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub OAuth sign-in plus a public OAuth-app quota path so GitPulse no longer depends on anonymous `60/hour/IP` limits for public traffic.

**Architecture:** Anonymous traffic should use cached public data and, when configured, authenticate public REST requests with GitHub OAuth app credentials. Signed-in users should carry their own GitHub access token in an encrypted cookie-backed session so deep analysis can run against the user's personal quota. GraphQL-heavy analysis remains gated behind a signed-in user token in this slice.

**Tech Stack:** Next.js 14 App Router, route handlers, signed/encrypted cookies via Node `crypto`, GitHub OAuth web application flow, Node test runner with `tsx`

---

### Task 1: Plan and auth primitives

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/github-auth.ts`
- Test: `tests/github-auth.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  encryptSession,
  decryptSession,
  resolveGitHubRequestAuth,
} from "@/lib/github-auth";

test("resolveGitHubRequestAuth prefers signed-in user token", () => {
  const result = resolveGitHubRequestAuth({
    userToken: "gho_user",
    oauthClientId: "abc",
    oauthClientSecret: "def",
  });

  assert.equal(result.mode, "user-token");
});

test("resolveGitHubRequestAuth falls back to oauth app public auth", () => {
  const result = resolveGitHubRequestAuth({
    oauthClientId: "abc",
    oauthClientSecret: "def",
  });

  assert.equal(result.mode, "oauth-app");
});

test("session payload round-trips through encryption", async () => {
  const token = await encryptSession(
    { accessToken: "gho_test", login: "octocat" },
    "01234567890123456789012345678901",
  );
  const session = await decryptSession(token, "01234567890123456789012345678901");

  assert.equal(session?.login, "octocat");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with missing exports for `resolveGitHubRequestAuth`, `encryptSession`, or `decryptSession`

- [ ] **Step 3: Write minimal implementation**

```ts
export function resolveGitHubRequestAuth(input: {
  userToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}) {
  if (input.userToken) return { mode: "user-token" as const, token: input.userToken };
  if (input.oauthClientId && input.oauthClientSecret) {
    return { mode: "oauth-app" as const };
  }
  return { mode: "anonymous" as const };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for `tests/github-auth.test.ts`

- [ ] **Step 5: Commit**

```bash
git add tests/github-auth.test.ts src/lib/auth.ts src/lib/github-auth.ts
git commit -m "feat: add auth mode primitives"
```

### Task 2: GitHub OAuth routes and session cookies

**Files:**
- Create: `src/app/api/auth/github/login/route.ts`
- Create: `src/app/api/auth/github/callback/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Modify: `src/lib/auth.ts`
- Test: `tests/auth-session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("buildGitHubAuthorizeUrl includes state and redirect uri", () => {
  const url = buildGitHubAuthorizeUrl({
    clientId: "Iv1.test",
    redirectUri: "http://localhost:3000/api/auth/github/callback",
    state: "state123",
  });

  assert.match(url.toString(), /client_id=Iv1\.test/);
  assert.match(url.toString(), /state=state123/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `buildGitHubAuthorizeUrl is not defined`

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildGitHubAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", "read:user");
  return url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS with OAuth URL helper and session tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/github/login/route.ts src/app/api/auth/github/callback/route.ts src/app/api/auth/logout/route.ts src/lib/auth.ts tests/auth-session.test.ts
git commit -m "feat: add github oauth session routes"
```

### Task 3: UI integration and data-layer auth selection

**Files:**
- Modify: `src/lib/github.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/user/[username]/page.tsx`
- Create: `src/components/auth-button.tsx`
- Test: `tests/github-data-auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("public requests prefer oauth app credentials over anonymous mode", () => {
  const result = resolveGitHubRequestAuth({
    oauthClientId: "abc",
    oauthClientSecret: "def",
  });

  assert.equal(result.mode, "oauth-app");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL if data-layer auth strategy is still hardcoded to `GITHUB_TOKEN`

- [ ] **Step 3: Write minimal implementation**

```ts
const auth = resolveGitHubRequestAuth({
  userToken,
  oauthClientId: process.env.GITHUB_OAUTH_CLIENT_ID,
  oauthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run lint && npm run build`
Expected: PASS with sign-in CTA rendered and public REST data using OAuth app credentials when configured

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts src/app/page.tsx src/app/user/[username]/page.tsx src/components/auth-button.tsx tests/github-data-auth.test.ts
git commit -m "feat: add oauth-aware public and user quota paths"
```

### Task 4: Docs and environment

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing doc expectation**

```md
README must explain:
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `SESSION_SECRET`
- OAuth callback URL
```

- [ ] **Step 2: Run verification to confirm docs are outdated**

Run: `rg "GITHUB_OAUTH_CLIENT_ID|SESSION_SECRET" README.md .env.example`
Expected: no matches

- [ ] **Step 3: Update docs**

```md
Add OAuth app setup instructions with callback:
http://localhost:3000/api/auth/github/callback
```

- [ ] **Step 4: Run verification**

Run: `rg "GITHUB_OAUTH_CLIENT_ID|SESSION_SECRET|callback" README.md .env.example`
Expected: matches in both files

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example
git commit -m "docs: add oauth app setup for production quota path"
```

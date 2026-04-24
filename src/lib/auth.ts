import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const GITHUB_SESSION_COOKIE = "gitpulse_github_session";
export const GITHUB_OAUTH_STATE_COOKIE = "gitpulse_github_oauth_state";
export const GITHUB_OAUTH_RETURN_TO_COOKIE = "gitpulse_github_oauth_return_to";

export type GitHubSession = {
  accessToken: string;
  login: string;
  avatarUrl?: string;
  name?: string | null;
};

type ResolveGitHubRequestAuthInput = {
  userToken?: string;
  serverToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
};

export type GitHubRequestAuth =
  | {
      mode: "user-token";
      token: string;
    }
  | {
      mode: "server-token";
      token: string;
    }
  | {
      mode: "oauth-app";
      basicAuth: string;
    }
  | {
      mode: "anonymous";
    };

export type GitHubAuthMode = GitHubRequestAuth["mode"];

export function resolveGitHubRequestAuth(input: ResolveGitHubRequestAuthInput) {
  if (input.userToken) {
    return {
      mode: "user-token" as const,
      token: input.userToken,
    };
  }

  if (input.serverToken) {
    return {
      mode: "server-token" as const,
      token: input.serverToken,
    };
  }

  if (input.oauthClientId && input.oauthClientSecret) {
    return {
      mode: "oauth-app" as const,
      basicAuth: toBasicAuth(input.oauthClientId, input.oauthClientSecret),
    };
  }

  return {
    mode: "anonymous" as const,
  };
}

export function summarizeGitHubAuthState(input: {
  session?: GitHubSession | null;
  serverToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}) {
  const session = input.session ?? null;
  const requestAuth = resolveGitHubRequestAuth({
    userToken: session?.accessToken,
    serverToken: input.serverToken,
    oauthClientId: input.oauthClientId,
    oauthClientSecret: input.oauthClientSecret,
  });

  return {
    mode: requestAuth.mode,
    session,
    canLogin: Boolean(input.oauthClientId && input.oauthClientSecret),
    hasOAuthApp: Boolean(input.oauthClientId && input.oauthClientSecret),
    canUseAuthenticatedApi: requestAuth.mode !== "anonymous",
    canUseGraphql: requestAuth.mode !== "anonymous",
    usesSharedQuota: requestAuth.mode !== "user-token",
  };
}

export function toGitHubApiHeaders(
  auth: GitHubRequestAuth,
  extraHeaders?: HeadersInit,
) {
  return {
    ...(auth.mode === "oauth-app"
      ? { Authorization: auth.basicAuth }
      : auth.mode === "user-token" || auth.mode === "server-token"
        ? { Authorization: `Bearer ${auth.token}` }
        : {}),
    ...normalizeHeadersInit(extraHeaders),
  };
}

export function buildGitHubAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", input.scope ?? "read:user");

  return url;
}

export function createOAuthState() {
  return randomBytes(16).toString("hex");
}

export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function encryptSession(
  payload: GitHubSession,
  secret: string,
): Promise<string> {
  const key = toAesKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((buffer) => buffer.toString("base64url"))
    .join(".");
}

export async function decryptSession(
  value: string,
  secret: string,
): Promise<GitHubSession | null> {
  try {
    const [ivEncoded, authTagEncoded, ciphertextEncoded] = value.split(".");

    if (!ivEncoded || !authTagEncoded || !ciphertextEncoded) {
      return null;
    }

    const key = toAesKey(secret);
    const iv = Buffer.from(ivEncoded, "base64url");
    const authTag = Buffer.from(authTagEncoded, "base64url");
    const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);

    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(plaintext) as GitHubSession;
  } catch {
    return null;
  }
}

export async function readGitHubSession(
  value: string | undefined,
  secret: string | undefined,
) {
  if (!value || !secret) {
    return null;
  }

  return decryptSession(value, secret);
}

export function getGitHubOAuthConfig() {
  return {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    redirectUri:
      process.env.GITHUB_OAUTH_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"}/api/auth/github/callback`,
    sessionSecret: process.env.SESSION_SECRET,
    serverToken: process.env.GITHUB_TOKEN,
  };
}

function toBasicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function toAesKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function normalizeHeadersInit(headers: HeadersInit | undefined) {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}

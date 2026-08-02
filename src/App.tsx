import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "./components/EmptyState";
import { ProfileView } from "./components/ProfileView";
import { fetchProfileAnalysis, normalizeUsername } from "./lib/github";
import type { ProfileAnalysis } from "./types";

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CACHED_PROFILES = 12;
const SESSION_CACHE_PREFIX = "ayayagitsum.profile.v2:";
const SESSION_CACHE_INDEX_KEY = `${SESSION_CACHE_PREFIX}index`;

interface CachedProfile {
  analysis: ProfileAnalysis;
  expiresAt: number;
}

interface ActiveRequest {
  cacheKey: string;
  controller: AbortController;
  requestId: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

const profileCache = new Map<string, CachedProfile>();

interface SessionCacheIndexEntry {
  cacheKey: string;
  expiresAt: number;
}

function isProfileAnalysis(value: unknown): value is ProfileAnalysis {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const user = candidate.user;
  return (
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.repositories) &&
    Array.isArray(candidate.warnings) &&
    typeof candidate.eventsAvailable === "boolean" &&
    !!candidate.repositoryCoverage &&
    typeof candidate.repositoryCoverage === "object" &&
    !!candidate.rateLimit &&
    typeof candidate.rateLimit === "object" &&
    !!user &&
    typeof user === "object" &&
    "login" in user &&
    typeof user.login === "string"
  );
}

function getCachedProfile(cacheKey: string): ProfileAnalysis | null {
  const now = Date.now();
  const cached = profileCache.get(cacheKey);
  if (cached) {
    if (cached.expiresAt > now) {
      profileCache.delete(cacheKey);
      profileCache.set(cacheKey, cached);
      return cached.analysis;
    }
    profileCache.delete(cacheKey);
  }

  try {
    const stored = window.sessionStorage.getItem(
      `${SESSION_CACHE_PREFIX}${cacheKey}`,
    );
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<CachedProfile>;
    if (
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now ||
      !isProfileAnalysis(parsed.analysis)
    ) {
      window.sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${cacheKey}`);
      return null;
    }

    const restored = {
      analysis: parsed.analysis,
      expiresAt: parsed.expiresAt,
    };
    profileCache.set(cacheKey, restored);
    return restored.analysis;
  } catch {
    return null;
  }
}

function cacheProfile(cacheKey: string, analysis: ProfileAnalysis) {
  const now = Date.now();
  const cached = {
    analysis,
    expiresAt: now + PROFILE_CACHE_TTL_MS,
  };

  for (const [key, entry] of profileCache) {
    if (entry.expiresAt <= now) {
      profileCache.delete(key);
    }
  }
  profileCache.delete(cacheKey);
  profileCache.set(cacheKey, cached);
  while (profileCache.size > MAX_CACHED_PROFILES) {
    const oldestKey = profileCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    profileCache.delete(oldestKey);
  }

  try {
    const rawIndex = window.sessionStorage.getItem(SESSION_CACHE_INDEX_KEY);
    const parsedIndex: unknown = rawIndex ? JSON.parse(rawIndex) : [];
    const validEntries = Array.isArray(parsedIndex)
      ? parsedIndex.filter(
          (entry): entry is SessionCacheIndexEntry =>
            !!entry &&
            typeof entry === "object" &&
            "cacheKey" in entry &&
            typeof entry.cacheKey === "string" &&
            "expiresAt" in entry &&
            typeof entry.expiresAt === "number",
        )
      : [];
    const nextIndex: SessionCacheIndexEntry[] = [];

    for (const entry of validEntries) {
      if (entry.expiresAt <= now) {
        window.sessionStorage.removeItem(
          `${SESSION_CACHE_PREFIX}${entry.cacheKey}`,
        );
      } else if (entry.cacheKey !== cacheKey) {
        nextIndex.push(entry);
      }
    }
    nextIndex.push({ cacheKey, expiresAt: cached.expiresAt });
    while (nextIndex.length > MAX_CACHED_PROFILES) {
      const removed = nextIndex.shift();
      if (removed) {
        window.sessionStorage.removeItem(
          `${SESSION_CACHE_PREFIX}${removed.cacheKey}`,
        );
      }
    }

    window.sessionStorage.setItem(
      `${SESSION_CACHE_PREFIX}${cacheKey}`,
      JSON.stringify(cached),
    );
    window.sessionStorage.setItem(
      SESSION_CACHE_INDEX_KEY,
      JSON.stringify(nextIndex),
    );
  } catch {
    // Memory caching still works when sessionStorage is unavailable or full.
  }
}

function isAbortError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function usernameFromHash(): string {
  const match = window.location.hash.match(/^#\/user\/([^/?#]+)/);
  if (!match) {
    return "";
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function setUserHash(username: string) {
  window.location.hash = `/user/${encodeURIComponent(username)}`;
}

export default function App() {
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const activeRequest = useRef<ActiveRequest | null>(null);

  const abortActiveRequest = useCallback(() => {
    requestId.current += 1;
    const request = activeRequest.current;
    if (!request) {
      return;
    }

    clearTimeout(request.timeoutId);
    request.controller.abort();
    activeRequest.current = null;
  }, []);

  const loadProfile = useCallback(async (rawUsername: string) => {
    const username = normalizeUsername(rawUsername);
    if (!username) {
      return;
    }

    const cacheKey = username.toLowerCase();
    const runningRequest = activeRequest.current;
    if (
      runningRequest?.cacheKey === cacheKey &&
      !runningRequest.controller.signal.aborted
    ) {
      return;
    }

    abortActiveRequest();

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setError(null);

    const cached = getCachedProfile(cacheKey);
    if (cached) {
      setAnalysis(cached);
      setLoading(false);
      document.title = `${cached.user.name ?? cached.user.login} · AyayaGitSum`;
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    activeRequest.current = {
      cacheKey,
      controller,
      requestId: currentRequest,
      timeoutId,
    };
    setLoading(true);

    try {
      const nextAnalysis = await fetchProfileAnalysis(
        username,
        controller.signal,
      );
      if (requestId.current === currentRequest) {
        cacheProfile(cacheKey, nextAnalysis);
        setAnalysis(nextAnalysis);
        document.title = `${nextAnalysis.user.name ?? nextAnalysis.user.login} · AyayaGitSum`;
      }
    } catch (requestError) {
      if (requestId.current !== currentRequest) {
        return;
      }

      if (timedOut) {
        setAnalysis(null);
        setError("请求 GitHub 数据超时，请检查网络后重试。");
        document.title = "AyayaGitSum";
      } else if (isAbortError(requestError)) {
        return;
      } else {
        setAnalysis(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "发生了未知错误，请稍后再试。",
        );
        document.title = "AyayaGitSum";
      }
    } finally {
      clearTimeout(timeoutId);
      if (activeRequest.current?.requestId === currentRequest) {
        activeRequest.current = null;
      }
      if (requestId.current === currentRequest) {
        setLoading(false);
      }
    }
  }, [abortActiveRequest]);

  useEffect(() => {
    function handleHashChange() {
      const username = usernameFromHash();
      if (username) {
        void loadProfile(username);
      } else {
        abortActiveRequest();
        setAnalysis(null);
        setError(null);
        setLoading(false);
        document.title = "AyayaGitSum";
      }
    }

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      abortActiveRequest();
    };
  }, [abortActiveRequest, loadProfile]);

  function handleSearch(username: string) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      return;
    }
    if (normalized.toLowerCase() === usernameFromHash().toLowerCase()) {
      void loadProfile(normalized);
    } else {
      abortActiveRequest();
      setUserHash(normalized);
    }
  }

  return (
    <div className="app-shell">
      {loading && !analysis ? (
        <main className="loading-state" aria-live="polite">
          <span className="loading-dot" aria-hidden="true" />
          <span className="sr-only">读取中</span>
        </main>
      ) : analysis ? (
        <ProfileView
          analysis={analysis}
          loading={loading}
          onSearch={handleSearch}
        />
      ) : (
        <EmptyState error={error} onSearch={handleSearch} />
      )}
    </div>
  );
}

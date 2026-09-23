import type { ProfileAnalysis } from "../types";

export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
export const MAX_CACHED_PROFILES = 12;
export const SESSION_CACHE_PREFIX = "ayayagitsum.profile.v3:";
const SESSION_CACHE_INDEX_KEY = `${SESSION_CACHE_PREFIX}index`;

interface CachedProfile {
  analysis: ProfileAnalysis;
  expiresAt: number;
}

interface SessionCacheIndexEntry {
  cacheKey: string;
  expiresAt: number;
}

export interface ProfileCache {
  get(cacheKey: string): ProfileAnalysis | null;
  set(cacheKey: string, analysis: ProfileAnalysis): void;
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
    Array.isArray(candidate.recentEvents) &&
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

function defaultSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createProfileCache(
  getStorage: () => Storage | null = defaultSessionStorage,
  now: () => number = Date.now,
): ProfileCache {
  // Map iteration order doubles as LRU order: hits are re-inserted at the end.
  const memory = new Map<string, CachedProfile>();

  function get(cacheKey: string): ProfileAnalysis | null {
    const currentTime = now();
    const cached = memory.get(cacheKey);
    if (cached) {
      memory.delete(cacheKey);
      if (cached.expiresAt > currentTime) {
        memory.set(cacheKey, cached);
        return cached.analysis;
      }
    }

    try {
      const storage = getStorage();
      const storageKey = `${SESSION_CACHE_PREFIX}${cacheKey}`;
      const stored = storage?.getItem(storageKey);
      if (!storage || !stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as Partial<CachedProfile>;
      if (
        typeof parsed.expiresAt !== "number" ||
        parsed.expiresAt <= currentTime ||
        !isProfileAnalysis(parsed.analysis)
      ) {
        storage.removeItem(storageKey);
        return null;
      }

      memory.set(cacheKey, {
        analysis: parsed.analysis,
        expiresAt: parsed.expiresAt,
      });
      return parsed.analysis;
    } catch {
      return null;
    }
  }

  function set(cacheKey: string, analysis: ProfileAnalysis): void {
    const currentTime = now();
    const cached = {
      analysis,
      expiresAt: currentTime + PROFILE_CACHE_TTL_MS,
    };

    for (const [key, entry] of memory) {
      if (entry.expiresAt <= currentTime) {
        memory.delete(key);
      }
    }
    memory.delete(cacheKey);
    memory.set(cacheKey, cached);
    while (memory.size > MAX_CACHED_PROFILES) {
      const oldestKey = memory.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      memory.delete(oldestKey);
    }

    try {
      const storage = getStorage();
      if (!storage) {
        return;
      }

      const rawIndex = storage.getItem(SESSION_CACHE_INDEX_KEY);
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
        if (entry.expiresAt <= currentTime) {
          storage.removeItem(`${SESSION_CACHE_PREFIX}${entry.cacheKey}`);
        } else if (entry.cacheKey !== cacheKey) {
          nextIndex.push(entry);
        }
      }
      nextIndex.push({ cacheKey, expiresAt: cached.expiresAt });
      while (nextIndex.length > MAX_CACHED_PROFILES) {
        const removed = nextIndex.shift();
        if (removed) {
          storage.removeItem(`${SESSION_CACHE_PREFIX}${removed.cacheKey}`);
        }
      }

      storage.setItem(
        `${SESSION_CACHE_PREFIX}${cacheKey}`,
        JSON.stringify(cached),
      );
      storage.setItem(SESSION_CACHE_INDEX_KEY, JSON.stringify(nextIndex));
    } catch {
      // Memory caching still works when sessionStorage is unavailable or full.
    }
  }

  return { get, set };
}

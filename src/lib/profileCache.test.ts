import { describe, expect, it } from "vitest";
import type { ProfileAnalysis } from "../types";
import {
  createProfileCache,
  MAX_CACHED_PROFILES,
  PROFILE_CACHE_TTL_MS,
  SESSION_CACHE_PREFIX,
} from "./profileCache";

class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear() {
    this.items.clear();
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

const analysis = (login: string): ProfileAnalysis => ({
  user: {
    login,
    name: null,
    avatar_url: "",
    html_url: `https://github.com/${login}`,
    bio: null,
    company: null,
    blog: "",
    location: null,
    public_repos: 0,
    followers: 0,
    following: 0,
    created_at: "2020-01-01T00:00:00Z",
  },
  repositories: [],
  repositoryCoverage: {
    fetchedCount: 0,
    reportedTotal: 0,
    isComplete: true,
    reason: "complete",
  },
  topRepositories: [],
  languages: [],
  activityByDay: [],
  recentEvents: [],
  eventsAvailable: true,
  totalStars: 0,
  originalRepositoryCount: 0,
  summary: `${login} summary`,
  warnings: [],
  rateLimit: { remaining: 50, resetAt: null, retryAfterSeconds: null },
});

function setup() {
  let time = 1_000_000;
  const storage = new MemoryStorage();
  const clock = {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
  return { storage, clock };
}

describe("createProfileCache", () => {
  it("serves entries until the TTL expires", () => {
    const { storage, clock } = setup();
    const cache = createProfileCache(() => storage, clock.now);

    cache.set("octocat", analysis("octocat"));
    clock.advance(PROFILE_CACHE_TTL_MS - 1);
    expect(cache.get("octocat")?.user.login).toBe("octocat");

    clock.advance(1);
    expect(cache.get("octocat")).toBeNull();
    expect(storage.getItem(`${SESSION_CACHE_PREFIX}octocat`)).toBeNull();
  });

  it("restores entries from sessionStorage in a fresh page instance", () => {
    const { storage, clock } = setup();
    createProfileCache(() => storage, clock.now).set(
      "octocat",
      analysis("octocat"),
    );

    const reloaded = createProfileCache(() => storage, clock.now);
    expect(reloaded.get("octocat")?.summary).toBe("octocat summary");
  });

  it("evicts the least recently used entries beyond the limit", () => {
    const { storage, clock } = setup();
    const cache = createProfileCache(() => storage, clock.now);

    for (let index = 0; index < MAX_CACHED_PROFILES; index += 1) {
      cache.set(`user-${index}`, analysis(`user-${index}`));
    }
    cache.set("newest", analysis("newest"));

    expect(storage.getItem(`${SESSION_CACHE_PREFIX}user-0`)).toBeNull();
    expect(storage.getItem(`${SESSION_CACHE_PREFIX}newest`)).not.toBeNull();
    const reloaded = createProfileCache(() => storage, clock.now);
    expect(reloaded.get("user-0")).toBeNull();
    expect(reloaded.get("user-1")).not.toBeNull();
  });

  it("drops malformed stored entries", () => {
    const { storage, clock } = setup();
    const key = `${SESSION_CACHE_PREFIX}broken`;
    storage.setItem(
      key,
      JSON.stringify({ expiresAt: clock.now() + 1000, analysis: {} }),
    );

    expect(createProfileCache(() => storage, clock.now).get("broken")).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("keeps working in memory when storage is unavailable or throws", () => {
    const { clock } = setup();
    const unavailable = createProfileCache(() => null, clock.now);
    unavailable.set("octocat", analysis("octocat"));
    expect(unavailable.get("octocat")?.user.login).toBe("octocat");

    const throwing = new MemoryStorage();
    throwing.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    const full = createProfileCache(() => throwing, clock.now);
    expect(() => full.set("octocat", analysis("octocat"))).not.toThrow();
    expect(full.get("octocat")?.user.login).toBe("octocat");
  });
});

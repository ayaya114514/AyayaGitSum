import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSummary,
  fetchProfileAnalysis,
  getActivityByDay,
  getLanguageShares,
  getTopRepositories,
  GitHubApiError,
  normalizeUsername,
  REQUEST_TIMEOUT_MS,
  validateUsername,
} from "./github";
import type {
  GitHubEvent,
  GitHubRepository,
  GitHubUser,
  RepositoryCoverage,
} from "../types";

const repository = (
  name: string,
  language: string | null,
  stars: number,
  fork = false,
): GitHubRepository => ({
  id: name.length + stars,
  name,
  html_url: `https://github.com/example/${name}`,
  description: null,
  language,
  stargazers_count: stars,
  forks_count: 0,
  fork,
  archived: false,
  pushed_at: null,
  topics: [],
});

const user = (publicRepositories = 3): GitHubUser => ({
  login: "example",
  name: "Example User",
  avatar_url: "",
  html_url: "https://github.com/example",
  bio: null,
  company: null,
  blog: "",
  location: null,
  public_repos: publicRepositories,
  followers: 0,
  following: 0,
  created_at: "2020-01-01T00:00:00Z",
});

const event = (
  id: string,
  createdAt = "2026-07-20T12:00:00Z",
): GitHubEvent => ({
  id,
  type: "PushEvent",
  repo: { name: "example/one" },
  payload: {},
  created_at: createdAt,
});

interface ResponseOptions {
  status?: number;
  remaining?: number;
  reset?: number;
  retryAfter?: number;
}

function jsonResponse(data: unknown, options: ResponseOptions = {}): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.remaining !== undefined) {
    headers.set("x-ratelimit-remaining", String(options.remaining));
  }
  if (options.reset !== undefined) {
    headers.set("x-ratelimit-reset", String(options.reset));
  }
  if (options.retryAfter !== undefined) {
    headers.set("retry-after", String(options.retryAfter));
  }
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers,
  });
}

function completeCoverage(
  fetchedCount: number,
  reportedTotal = fetchedCount,
): RepositoryCoverage {
  return {
    fetchedCount,
    reportedTotal,
    isComplete: true,
    reason: "complete",
  };
}

function hangUntilAborted(
  _input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    );
  });
}

function requestedPage(url: string): number | null {
  const page = new URL(url).searchParams.get("page");
  return page === null ? null : Number.parseInt(page, 10);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GitHub data helpers", () => {
  it("normalizes and validates GitHub usernames", () => {
    expect(normalizeUsername("  @@octocat ")).toBe("octocat");
    expect(validateUsername("octocat")).toBeNull();
    expect(validateUsername("a-b-9")).toBeNull();
    expect(validateUsername("")).toBe("请输入 GitHub 用户名。");
    expect(validateUsername("-octocat")).toContain("不能以连字符开头或结尾");
    expect(validateUsername("octo--cat")).toContain("单个连字符");
    expect(validateUsername("octo_cat")).toContain("只能包含");
    expect(validateUsername("a".repeat(40))).toContain("39 个字符");
  });

  it("sorts original repositories by stars", () => {
    const repositories = [
      repository("small", "TypeScript", 2),
      repository("forked", "Go", 100, true),
      repository("popular", "TypeScript", 20),
    ];
    expect(getTopRepositories(repositories).map((item) => item.name)).toEqual([
      "popular",
      "small",
    ]);
  });

  it("calculates language shares from original repositories", () => {
    const repositories = [
      repository("one", "TypeScript", 1),
      repository("two", "TypeScript", 1),
      repository("three", "Python", 1),
      repository("forked", "Go", 1, true),
    ];
    expect(getLanguageShares(repositories)).toEqual([
      { name: "TypeScript", count: 2, percentage: 67 },
      { name: "Python", count: 1, percentage: 33 },
    ]);
  });

  it("uses the browser-local weekday instead of the UTC weekday", () => {
    vi.spyOn(Date.prototype, "getDay").mockReturnValue(2);

    const activity = getActivityByDay([event("1")]);

    expect(activity.find((item) => item.day === "周二")?.count).toBe(1);
    expect(activity.find((item) => item.day === "周一")?.count).toBe(0);
  });

  it("creates complete and sample-aware summaries", () => {
    const repositories = [repository("one", "TypeScript", 1)];
    const languages = [{ name: "TypeScript", count: 1, percentage: 100 }];

    const complete = createSummary(
      user(1),
      repositories,
      languages,
      [event("1")],
      completeCoverage(1),
    );
    expect(complete).toContain("其中 1 个为原创仓库");
    expect(complete).toContain("最常见的主要语言是 TypeScript");
    expect(complete).not.toContain("样本");

    const sample = createSummary(
      user(500),
      repositories,
      languages,
      [],
      {
        fetchedCount: 1,
        reportedTotal: 500,
        isComplete: false,
        reason: "page-limit",
      },
    );
    expect(sample).toContain("本次读取的 1 个仓库样本中");
    expect(sample).toContain("在已读取仓库中");
  });
});

describe("fetchProfileAnalysis", () => {
  it("rejects invalid usernames before making a request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchProfileAnalysis("bad/name")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the user first, paginates repositories, and aggregates the lowest remaining quota", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      repository(`repo-${index}`, "TypeScript", index),
    );
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(101), {
          remaining: 59,
          reset: 2_000_000_000,
        });
      }
      if (url.includes("/repos?") && requestedPage(url) === 1) {
        return jsonResponse(firstPage, {
          remaining: 56,
          reset: 2_000_000_000,
        });
      }
      if (url.includes("/repos?") && requestedPage(url) === 2) {
        return jsonResponse([repository("last", "Go", 1)], {
          remaining: 52,
          reset: 2_000_000_000,
        });
      }
      if (url.includes("/events/public")) {
        return jsonResponse([event("1")], {
          remaining: 54,
          reset: 2_000_000_000,
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.github.com/users/example",
    );
    expect(analysis.repositories).toHaveLength(101);
    expect(analysis.repositoryCoverage).toEqual({
      fetchedCount: 101,
      reportedTotal: 101,
      isComplete: true,
      reason: "complete",
    });
    expect(analysis.rateLimit).toEqual({
      remaining: 52,
      resetAt: new Date(2_000_000_000_000).toISOString(),
      retryAfterSeconds: null,
    });
    expect(analysis.eventsAvailable).toBe(true);
    expect(analysis.warnings).toEqual([]);
  });

  it("caps repository pagination at 300 and labels all derived values as a sample", async () => {
    const page = (pageNumber: number) =>
      Array.from({ length: 100 }, (_, index) =>
        repository(`page-${pageNumber}-${index}`, "TypeScript", index),
      );
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(350), { remaining: 59 });
      }
      if (url.includes("/events/public")) {
        return jsonResponse([], { remaining: 55 });
      }
      if (requestedPage(url) === 1) {
        return jsonResponse(page(1), { remaining: 58 });
      }
      if (requestedPage(url) === 2) {
        return jsonResponse(page(2), { remaining: 54 });
      }
      if (requestedPage(url) === 3) {
        return jsonResponse(page(3), { remaining: 53 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(analysis.repositoryCoverage).toEqual({
      fetchedCount: 300,
      reportedTotal: 350,
      isComplete: false,
      reason: "page-limit",
    });
    expect(analysis.summary).toContain("本次读取的 300 个仓库样本中");
    expect(analysis.warnings[0]).toContain("前 300 个仓库");
    expect(
      fetchMock.mock.calls.some(
        ([input]) => requestedPage(String(input)) === 4,
      ),
    ).toBe(false);
  });

  it("requests every planned repository page at once when the quota allows", async () => {
    const page = (pageNumber: number, length = 100) =>
      Array.from({ length }, (_, index) =>
        repository(`page-${pageNumber}-${index}`, "TypeScript", index),
      );
    let releaseFirstPage!: () => void;
    const firstPageGate = new Promise<void>((resolve) => {
      releaseFirstPage = resolve;
    });
    const requestedPages: number[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(250), { remaining: 59 });
      }
      if (url.includes("/events/public")) {
        return jsonResponse([], { remaining: 57 });
      }
      const pageNumber = requestedPage(url);
      if (pageNumber !== null) requestedPages.push(pageNumber);
      if (pageNumber === 1) {
        await firstPageGate;
        return jsonResponse(page(1), { remaining: 56 });
      }
      if (pageNumber === 2) return jsonResponse(page(2), { remaining: 55 });
      if (pageNumber === 3) return jsonResponse(page(3, 50), { remaining: 54 });
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchProfileAnalysis("example");
    await vi.waitFor(() => expect(requestedPages).toEqual([1, 2, 3]));
    releaseFirstPage();
    const analysis = await pending;

    expect(analysis.repositories.map((repo) => repo.name).slice(0, 1)).toEqual([
      "page-1-0",
    ]);
    expect(analysis.repositoryCoverage).toEqual({
      fetchedCount: 250,
      reportedTotal: 250,
      isComplete: true,
      reason: "complete",
    });
  });

  it("stops pagination when the remaining quota reaches the safety reserve", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      repository(`repo-${index}`, "TypeScript", index),
    );
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(200), { remaining: 4 });
      }
      if (url.includes("/repos?")) {
        return jsonResponse(firstPage, { remaining: 2 });
      }
      if (url.includes("/events/public")) {
        return jsonResponse([], { remaining: 8 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(analysis.repositoryCoverage.reason).toBe("rate-limit");
    expect(analysis.repositoryCoverage.isComplete).toBe(false);
    expect(analysis.repositories).toHaveLength(100);
    expect(analysis.rateLimit.remaining).toBe(2);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/repos?"),
      ),
    ).toHaveLength(1);
  });

  it("keeps the profile and activity when the repository endpoint fails", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(3), { remaining: 10 });
      }
      if (url.includes("/repos?")) {
        return jsonResponse({ message: "failure" }, { status: 500, remaining: 7 });
      }
      if (url.includes("/events/public")) {
        return jsonResponse([event("1")], { remaining: 8 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(analysis.user.login).toBe("example");
    expect(analysis.repositoryCoverage).toMatchObject({
      fetchedCount: 0,
      isComplete: false,
      reason: "request-failed",
    });
    expect(analysis.eventsAvailable).toBe(true);
    expect(analysis.recentEvents).toHaveLength(1);
    expect(analysis.warnings).toContain(
      "仓库数据暂时无法读取，相关统计不可用。",
    );
    expect(analysis.rateLimit.remaining).toBe(7);
  });

  it("keeps repository data when the event endpoint has a network failure", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(1), { remaining: 10 });
      }
      if (url.includes("/repos?")) {
        return jsonResponse([repository("one", "TypeScript", 4)], {
          remaining: 9,
        });
      }
      if (url.includes("/events/public")) {
        throw new TypeError("Failed to fetch");
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(analysis.repositories).toHaveLength(1);
    expect(analysis.totalStars).toBe(4);
    expect(analysis.eventsAvailable).toBe(false);
    expect(analysis.recentEvents).toEqual([]);
    expect(analysis.warnings).toContain("最近活动暂时无法读取。");
  });

  it("keeps an honest repository sample if a later page fails", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      repository(`repo-${index}`, "TypeScript", index),
    );
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(150), { remaining: 20 });
      }
      if (requestedPage(url) === 1) {
        return jsonResponse(firstPage, { remaining: 18 });
      }
      if (requestedPage(url) === 2) {
        return jsonResponse({ message: "failure" }, { status: 500, remaining: 16 });
      }
      if (url.includes("/events/public")) {
        return jsonResponse([], { remaining: 17 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(analysis.repositories).toHaveLength(100);
    expect(analysis.repositoryCoverage).toMatchObject({
      fetchedCount: 100,
      isComplete: false,
      reason: "request-failed",
    });
    expect(analysis.summary).toContain("100 个仓库样本");
    expect(analysis.rateLimit.remaining).toBe(16);
  });

  it("collects reset and retry metadata from a degraded optional request", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(1), {
          remaining: 10,
          reset: 2_000_000_000,
        });
      }
      if (url.includes("/repos?")) {
        return jsonResponse([repository("one", "TypeScript", 1)], {
          remaining: 9,
          reset: 2_000_000_000,
        });
      }
      if (url.includes("/events/public")) {
        return jsonResponse(
          { message: "secondary rate limit" },
          {
            status: 429,
            remaining: 0,
            reset: 2_000_000_100,
            retryAfter: 120,
          },
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(analysis.eventsAvailable).toBe(false);
    expect(analysis.rateLimit).toEqual({
      remaining: 0,
      resetAt: new Date(2_000_000_100_000).toISOString(),
      retryAfterSeconds: 120,
    });
  });

  it("normalizes mandatory network, JSON, not-found, and rate-limit errors", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(fetchProfileAnalysis("example")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 0,
      message: "无法连接 GitHub，请检查网络后重试。",
    });

    fetchMock.mockResolvedValueOnce(
      new Response("{invalid", {
        status: 200,
        headers: { "x-ratelimit-remaining": "9" },
      }),
    );
    await expect(fetchProfileAnalysis("example")).rejects.toMatchObject({
      name: "GitHubApiError",
      message: "GitHub 返回的数据格式异常，请稍后再试。",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 404, remaining: 8 }));
    await expect(fetchProfileAnalysis("example")).rejects.toMatchObject({
      status: 404,
      message: "没有找到这个 GitHub 用户。",
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: "rate limited" },
        {
          status: 429,
          remaining: 0,
          reset: 2_000_000_000,
          retryAfter: 60,
        },
      ),
    );
    const rateError = await fetchProfileAnalysis("example").catch(
      (error: unknown) => error,
    );
    expect(rateError).toBeInstanceOf(GitHubApiError);
    expect(rateError).toMatchObject({
      status: 429,
      rateLimit: {
        remaining: 0,
        resetAt: new Date(2_000_000_000_000).toISOString(),
        retryAfterSeconds: 60,
      },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: "forbidden" },
        { status: 403, remaining: 7 },
      ),
    );
    await expect(fetchProfileAnalysis("example")).rejects.toMatchObject({
      status: 403,
      message: "GitHub 暂时拒绝了这次请求，请稍后再试。",
    });
  });

  it("forwards caller aborts to fetch and preserves AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal?.aborted).toBe(true);
      throw init?.signal?.reason;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchProfileAnalysis("example", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps AbortError when the caller aborts while the body is being read", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(async () => {
      const response = jsonResponse(user(1), { remaining: 10 });
      vi.spyOn(response, "json").mockImplementation(async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      });
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchProfileAnalysis("example", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reports a timeout when the mandatory user request hangs", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn<typeof fetch>(hangUntilAborted));

      const pending = fetchProfileAnalysis("example").catch(
        (error: unknown) => error,
      );
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

      await expect(pending).resolves.toMatchObject({
        name: "GitHubApiError",
        status: 0,
        message: "请求 GitHub 数据超时，请检查网络后重试。",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps repository data when only the event request times out", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/users/example")) {
          return jsonResponse(user(1), { remaining: 10 });
        }
        if (url.includes("/repos?")) {
          return jsonResponse([repository("one", "TypeScript", 4)], {
            remaining: 9,
          });
        }
        return hangUntilAborted(input, init);
      });
      vi.stubGlobal("fetch", fetchMock);

      const pending = fetchProfileAnalysis("example");
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      const analysis = await pending;

      expect(analysis.repositories).toHaveLength(1);
      expect(analysis.eventsAvailable).toBe(false);
      expect(analysis.warnings).toContain("最近活动暂时无法读取。");
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts stars from original repositories and keeps six recent events", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/users/example")) {
        return jsonResponse(user(2), { remaining: 10 });
      }
      if (url.includes("/repos?")) {
        return jsonResponse(
          [
            repository("mine", "TypeScript", 4),
            repository("forked", "Go", 100, true),
          ],
          { remaining: 9 },
        );
      }
      if (url.includes("/events/public")) {
        return jsonResponse(
          Array.from({ length: 10 }, (_, index) => event(String(index))),
          { remaining: 8 },
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const analysis = await fetchProfileAnalysis("example");

    expect(analysis.totalStars).toBe(4);
    expect(analysis.recentEvents.map((item) => item.id)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(
      analysis.activityByDay.reduce((sum, item) => sum + item.count, 0),
    ).toBe(10);
  });
});

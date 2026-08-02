import type {
  ActivityDay,
  GitHubEvent,
  GitHubRateLimit,
  GitHubRepository,
  GitHubUser,
  LanguageShare,
  ProfileAnalysis,
  RepositoryCoverage,
} from "../types";

const API_ROOT = "https://api.github.com";
export const REPOSITORIES_PER_PAGE = 100;
export const MAX_REPOSITORY_PAGES = 3;
const REPOSITORY_PAGINATION_RESERVE = 2;
const API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const EMPTY_RATE_LIMIT: GitHubRateLimit = {
  remaining: null,
  resetAt: null,
  retryAfterSeconds: null,
};

export class GitHubApiError extends Error {
  status: number;
  rateLimit: GitHubRateLimit;

  constructor(
    message: string,
    status: number,
    rateLimit: GitHubRateLimit = EMPTY_RATE_LIMIT,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GitHubApiError";
    this.status = status;
    this.rateLimit = rateLimit;
  }
}

interface ApiResponse<T> {
  data: T;
  rateLimit: GitHubRateLimit;
}

interface RepositoryFetchResult {
  repositories: GitHubRepository[];
  coverage: RepositoryCoverage;
  rateLimits: GitHubRateLimit[];
  warning: string | null;
}

interface EventFetchResult {
  events: GitHubEvent[];
  available: boolean;
  rateLimit: GitHubRateLimit | null;
  warning: string | null;
}

function parseIntegerHeader(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseRateLimit(headers: Headers): GitHubRateLimit {
  const remaining = parseIntegerHeader(headers.get("x-ratelimit-remaining"));
  const resetSeconds = parseIntegerHeader(headers.get("x-ratelimit-reset"));
  const retryAfter = headers.get("retry-after");
  let retryAfterSeconds = parseIntegerHeader(retryAfter);

  if (retryAfter !== null && retryAfterSeconds === null) {
    const retryAt = Date.parse(retryAfter);
    if (!Number.isNaN(retryAt)) {
      retryAfterSeconds = Math.max(
        0,
        Math.ceil((retryAt - Date.now()) / 1_000),
      );
    }
  }

  let resetAt: string | null = null;
  if (resetSeconds !== null) {
    const resetDate = new Date(resetSeconds * 1_000);
    if (!Number.isNaN(resetDate.getTime())) {
      resetAt = resetDate.toISOString();
    }
  }

  return { remaining, resetAt, retryAfterSeconds };
}

function mergeRateLimits(rateLimits: GitHubRateLimit[]): GitHubRateLimit {
  const remainingValues = rateLimits
    .map((rateLimit) => rateLimit.remaining)
    .filter((remaining): remaining is number => remaining !== null);
  const resetValues = rateLimits
    .map((rateLimit) => rateLimit.resetAt)
    .filter((resetAt): resetAt is string => resetAt !== null);
  const retryValues = rateLimits
    .map((rateLimit) => rateLimit.retryAfterSeconds)
    .filter((seconds): seconds is number => seconds !== null);

  return {
    remaining:
      remainingValues.length > 0 ? Math.min(...remainingValues) : null,
    resetAt:
      resetValues.length > 0
        ? resetValues.reduce((latest, current) =>
            current > latest ? current : latest,
          )
        : null,
    retryAfterSeconds:
      retryValues.length > 0 ? Math.max(...retryValues) : null,
  };
}

function isRateLimitResponse(
  status: number,
  rateLimit: GitHubRateLimit,
): boolean {
  return (
    status === 429 ||
    (status === 403 &&
      (rateLimit.remaining === 0 || rateLimit.retryAfterSeconds !== null))
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function throwIfAborted(error: unknown, signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? error;
  }
  if (isAbortError(error)) {
    throw error;
  }
}

async function request<T>(
  path: string,
  signal?: AbortSignal,
): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: API_HEADERS,
      signal,
    });
  } catch (error) {
    throwIfAborted(error, signal);
    throw new GitHubApiError(
      "无法连接 GitHub，请检查网络后重试。",
      0,
      EMPTY_RATE_LIMIT,
      { cause: error },
    );
  }

  const rateLimit = parseRateLimit(response.headers);

  if (!response.ok) {
    if (isRateLimitResponse(response.status, rateLimit)) {
      throw new GitHubApiError(
        "GitHub API 的临时访问额度已用完，请稍后再试。",
        response.status,
        rateLimit,
      );
    }
    if (response.status === 403) {
      throw new GitHubApiError(
        "GitHub 暂时拒绝了这次请求，请稍后再试。",
        response.status,
        rateLimit,
      );
    }
    if (response.status === 404) {
      throw new GitHubApiError("GitHub 上没有找到请求的数据。", 404, rateLimit);
    }
    throw new GitHubApiError(
      "读取 GitHub 数据失败，请稍后再试。",
      response.status,
      rateLimit,
    );
  }

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch (error) {
    throw new GitHubApiError(
      "GitHub 返回的数据格式异常，请稍后再试。",
      response.status,
      rateLimit,
      { cause: error },
    );
  }

  return {
    data,
    rateLimit,
  };
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "");
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);

  if (!username) {
    return "请输入 GitHub 用户名。";
  }
  if (username.length > 39) {
    return "GitHub 用户名不能超过 39 个字符。";
  }
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username)) {
    return "GitHub 用户名只能包含字母、数字或单个连字符，且不能以连字符开头或结尾。";
  }

  return null;
}

export function getTopRepositories(
  repositories: GitHubRepository[],
  limit = 6,
): GitHubRepository[] {
  return repositories
    .filter((repository) => !repository.fork && !repository.archived)
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        b.forks_count - a.forks_count ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

export function getLanguageShares(
  repositories: GitHubRepository[],
  limit = 5,
): LanguageShare[] {
  const counts = new Map<string, number>();

  repositories
    .filter((repository) => !repository.fork && repository.language)
    .forEach((repository) => {
      const language = repository.language as string;
      counts.set(language, (counts.get(language) ?? 0) + 1);
    });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, count]) => sum + count, 0);

  return sorted.slice(0, limit).map(([name, count]) => ({
    name,
    count,
    percentage: total === 0 ? 0 : Math.round((count / total) * 100),
  }));
}

export function getActivityByDay(events: GitHubEvent[]): ActivityDay[] {
  const labels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const counts = Array.from({ length: 7 }, () => 0);

  events.forEach((event) => {
    const date = new Date(event.created_at);
    if (!Number.isNaN(date.getTime())) {
      counts[date.getDay()] += 1;
    }
  });

  return labels.map((day, index) => ({ day, count: counts[index] }));
}

export function createSummary(
  user: GitHubUser,
  repositories: GitHubRepository[],
  languages: LanguageShare[],
  events: GitHubEvent[],
  coverage: RepositoryCoverage,
): string {
  const originalRepositories = repositories.filter(
    (repository) => !repository.fork,
  );
  const topLanguage = languages[0]?.name;
  const activeDays = new Set(
    events
      .map((event) => {
        const date = new Date(event.created_at);
        if (Number.isNaN(date.getTime())) {
          return null;
        }
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      })
      .filter((date): date is string => date !== null),
  ).size;
  const parts = [
    `${user.name ?? user.login} 在 GitHub 上公开了 ${user.public_repos} 个仓库`,
  ];

  if (coverage.isComplete) {
    parts.push(`其中 ${originalRepositories.length} 个为原创仓库`);
  } else if (repositories.length > 0) {
    parts.push(
      `本次读取的 ${repositories.length} 个仓库样本中，${originalRepositories.length} 个为原创仓库`,
    );
  } else {
    parts.push("仓库详情暂时不可用");
  }

  if (topLanguage) {
    parts.push(
      coverage.isComplete
        ? `最常见的主要语言是 ${topLanguage}`
        : `在已读取仓库中，最常见的主要语言是 ${topLanguage}`,
    );
  }
  if (events.length > 0) {
    parts.push(`最近的公开事件分布在 ${activeDays} 个活跃日`);
  }

  return `${parts.join("，")}。`;
}

function unavailableRepositoryResult(
  reportedTotal: number,
  reason: "rate-limit" | "request-failed",
  rateLimit?: GitHubRateLimit,
): RepositoryFetchResult {
  return {
    repositories: [],
    coverage: {
      fetchedCount: 0,
      reportedTotal,
      isComplete: reportedTotal === 0,
      reason: reportedTotal === 0 ? "complete" : reason,
    },
    rateLimits: rateLimit ? [rateLimit] : [],
    warning:
      reportedTotal === 0
        ? null
        : reason === "rate-limit"
          ? "GitHub API 额度不足，仓库详情本次未读取。"
          : "仓库数据暂时无法读取，相关统计不可用。",
  };
}

async function fetchRepositories(
  username: string,
  reportedTotal: number,
  signal?: AbortSignal,
): Promise<RepositoryFetchResult> {
  if (reportedTotal === 0) {
    return unavailableRepositoryResult(0, "request-failed");
  }

  const repositories: GitHubRepository[] = [];
  const rateLimits: GitHubRateLimit[] = [];

  for (let page = 1; page <= MAX_REPOSITORY_PAGES; page += 1) {
    let response: ApiResponse<GitHubRepository[]>;
    try {
      response = await request<GitHubRepository[]>(
        `/users/${encodeURIComponent(username)}/repos?per_page=${REPOSITORIES_PER_PAGE}&sort=updated&page=${page}`,
        signal,
      );
      if (!Array.isArray(response.data)) {
        throw new GitHubApiError(
          "GitHub 返回的数据格式异常，请稍后再试。",
          200,
          response.rateLimit,
        );
      }
    } catch (error) {
      throwIfAborted(error, signal);
      const rateLimit =
        error instanceof GitHubApiError ? error.rateLimit : EMPTY_RATE_LIMIT;
      const failureReason =
        error instanceof GitHubApiError &&
        isRateLimitResponse(error.status, error.rateLimit)
          ? "rate-limit"
          : "request-failed";
      let warning: string;
      if (failureReason === "rate-limit") {
        warning =
          repositories.length > 0
            ? `GitHub API 额度不足，相关统计仅基于已读取的 ${repositories.length} 个仓库。`
            : "GitHub API 额度不足，仓库详情本次未读取。";
      } else {
        warning =
          repositories.length > 0
            ? `仓库列表读取中断，相关统计仅基于已读取的 ${repositories.length} 个仓库。`
            : "仓库数据暂时无法读取，相关统计不可用。";
      }
      rateLimits.push(rateLimit);
      return {
        repositories,
        coverage: {
          fetchedCount: repositories.length,
          reportedTotal,
          isComplete: false,
          reason: failureReason,
        },
        rateLimits,
        warning,
      };
    }

    repositories.push(...response.data);
    rateLimits.push(response.rateLimit);

    const endpointExhausted = response.data.length < REPOSITORIES_PER_PAGE;
    const reportedTotalCovered = repositories.length >= reportedTotal;
    if (endpointExhausted || reportedTotalCovered) {
      return {
        repositories,
        coverage: {
          fetchedCount: repositories.length,
          reportedTotal,
          isComplete: true,
          reason: "complete",
        },
        rateLimits,
        warning: null,
      };
    }

    if (
      response.rateLimit.remaining !== null &&
      response.rateLimit.remaining <= REPOSITORY_PAGINATION_RESERVE
    ) {
      return {
        repositories,
        coverage: {
          fetchedCount: repositories.length,
          reportedTotal,
          isComplete: false,
          reason: "rate-limit",
        },
        rateLimits,
        warning: `为保留 GitHub API 额度，本次仅分析最近更新的 ${repositories.length} 个仓库。`,
      };
    }
  }

  return {
    repositories,
    coverage: {
      fetchedCount: repositories.length,
      reportedTotal,
      isComplete: false,
      reason: "page-limit",
    },
    rateLimits,
    warning: `该用户仓库较多，本次仅分析最近更新的前 ${repositories.length} 个仓库。`,
  };
}

async function fetchEvents(
  username: string,
  signal?: AbortSignal,
): Promise<EventFetchResult> {
  try {
    const response = await request<GitHubEvent[]>(
      `/users/${encodeURIComponent(username)}/events/public?per_page=100`,
      signal,
    );
    if (!Array.isArray(response.data)) {
      throw new GitHubApiError(
        "GitHub 返回的数据格式异常，请稍后再试。",
        200,
        response.rateLimit,
      );
    }
    return {
      events: response.data,
      available: true,
      rateLimit: response.rateLimit,
      warning: null,
    };
  } catch (error) {
    throwIfAborted(error, signal);
    return {
      events: [],
      available: false,
      rateLimit:
        error instanceof GitHubApiError ? error.rateLimit : EMPTY_RATE_LIMIT,
      warning: "最近活动暂时无法读取。",
    };
  }
}

export async function fetchProfileAnalysis(
  rawUsername: string,
  signal?: AbortSignal,
): Promise<ProfileAnalysis> {
  const username = normalizeUsername(rawUsername);
  const validationError = validateUsername(username);
  if (validationError) {
    throw new GitHubApiError(validationError, 400);
  }

  let userResponse: ApiResponse<GitHubUser>;
  try {
    userResponse = await request<GitHubUser>(
      `/users/${encodeURIComponent(username)}`,
      signal,
    );
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      throw new GitHubApiError(
        "没有找到这个 GitHub 用户。",
        404,
        error.rateLimit,
        { cause: error },
      );
    }
    throw error;
  }

  const user = userResponse.data;
  if (
    !user ||
    typeof user !== "object" ||
    typeof user.login !== "string" ||
    !Number.isInteger(user.public_repos) ||
    user.public_repos < 0
  ) {
    throw new GitHubApiError(
      "GitHub 返回的数据格式异常，请稍后再试。",
      200,
      userResponse.rateLimit,
    );
  }

  let repositoryResult: RepositoryFetchResult;
  let eventResult: EventFetchResult;
  if (userResponse.rateLimit.remaining === 0) {
    repositoryResult = unavailableRepositoryResult(
      user.public_repos,
      "rate-limit",
    );
    eventResult = {
      events: [],
      available: false,
      rateLimit: null,
      warning: "GitHub API 额度不足，最近活动本次未读取。",
    };
  } else if (userResponse.rateLimit.remaining === 1 && user.public_repos > 0) {
    [repositoryResult, eventResult] = await Promise.all([
      fetchRepositories(username, user.public_repos, signal),
      Promise.resolve({
        events: [],
        available: false,
        rateLimit: null,
        warning: "为保留 GitHub API 额度，最近活动本次未读取。",
      }),
    ]);
  } else {
    [repositoryResult, eventResult] = await Promise.all([
      fetchRepositories(username, user.public_repos, signal),
      fetchEvents(username, signal),
    ]);
  }

  const repositories = repositoryResult.repositories;
  const recentEvents = eventResult.events.slice(0, 12);
  const languages = getLanguageShares(repositories);
  const originalRepositories = repositories.filter(
    (repository) => !repository.fork,
  );

  return {
    user,
    repositories,
    repositoryCoverage: repositoryResult.coverage,
    topRepositories: getTopRepositories(repositories),
    languages,
    activityByDay: getActivityByDay(eventResult.events),
    recentEvents,
    eventsAvailable: eventResult.available,
    totalStars: repositories.reduce(
      (sum, repository) => sum + repository.stargazers_count,
      0,
    ),
    originalRepositoryCount: originalRepositories.length,
    summary: createSummary(
      user,
      repositories,
      languages,
      eventResult.events,
      repositoryResult.coverage,
    ),
    warnings: [repositoryResult.warning, eventResult.warning].filter(
      (warning): warning is string => warning !== null,
    ),
    rateLimit: mergeRateLimits([
      userResponse.rateLimit,
      ...repositoryResult.rateLimits,
      ...(eventResult.rateLimit ? [eventResult.rateLimit] : []),
    ]),
  };
}

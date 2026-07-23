import type {
  ActivityDay,
  GitHubEvent,
  GitHubRepository,
  GitHubUser,
  LanguageShare,
  ProfileAnalysis,
} from "../types";

const API_ROOT = "https://api.github.com";
const API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export class GitHubApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

interface ApiResponse<T> {
  data: T;
  rateLimitRemaining: number | null;
}

async function request<T>(
  path: string,
  signal?: AbortSignal,
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: API_HEADERS,
    signal,
  });
  const remainingHeader = response.headers.get("x-ratelimit-remaining");
  const rateLimitRemaining =
    remainingHeader === null ? null : Number.parseInt(remainingHeader, 10);

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubApiError("没有找到这个 GitHub 用户。", 404);
    }
    if (response.status === 403 || response.status === 429) {
      throw new GitHubApiError(
        "GitHub API 的临时访问额度已用完，请稍后再试。",
        response.status,
      );
    }
    throw new GitHubApiError("读取 GitHub 数据失败，请稍后再试。", response.status);
  }

  return {
    data: (await response.json()) as T,
    rateLimitRemaining: Number.isNaN(rateLimitRemaining)
      ? null
      : rateLimitRemaining,
  };
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "");
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
      counts[date.getUTCDay()] += 1;
    }
  });

  return labels.map((day, index) => ({ day, count: counts[index] }));
}

export function createSummary(
  user: GitHubUser,
  repositories: GitHubRepository[],
  languages: LanguageShare[],
  events: GitHubEvent[],
): string {
  const originalRepositories = repositories.filter(
    (repository) => !repository.fork,
  );
  const topLanguage = languages[0]?.name;
  const activeDays = new Set(
    events.map((event) => event.created_at.slice(0, 10)).filter(Boolean),
  ).size;
  const parts = [
    `${user.name ?? user.login} 在 GitHub 上公开了 ${user.public_repos} 个仓库`,
    `其中当前列表包含 ${originalRepositories.length} 个原创仓库`,
  ];

  if (topLanguage) {
    parts.push(`最常见的主要语言是 ${topLanguage}`);
  }
  if (events.length > 0) {
    parts.push(`最近的公开事件分布在 ${activeDays} 个活跃日`);
  }

  return `${parts.join("，")}。`;
}

export async function fetchProfileAnalysis(
  rawUsername: string,
  signal?: AbortSignal,
): Promise<ProfileAnalysis> {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    throw new GitHubApiError("请输入 GitHub 用户名。", 400);
  }

  const [userResponse, repositoryResponse, eventResponse] = await Promise.all([
    request<GitHubUser>(`/users/${encodeURIComponent(username)}`, signal),
    request<GitHubRepository[]>(
      `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
      signal,
    ),
    request<GitHubEvent[]>(
      `/users/${encodeURIComponent(username)}/events/public?per_page=100`,
      signal,
    ),
  ]);

  const repositories = repositoryResponse.data;
  const recentEvents = eventResponse.data.slice(0, 12);
  const languages = getLanguageShares(repositories);
  const originalRepositories = repositories.filter(
    (repository) => !repository.fork,
  );

  return {
    user: userResponse.data,
    repositories,
    topRepositories: getTopRepositories(repositories),
    languages,
    activityByDay: getActivityByDay(eventResponse.data),
    recentEvents,
    totalStars: repositories.reduce(
      (sum, repository) => sum + repository.stargazers_count,
      0,
    ),
    originalRepositoryCount: originalRepositories.length,
    summary: createSummary(
      userResponse.data,
      repositories,
      languages,
      eventResponse.data,
    ),
    rateLimitRemaining:
      eventResponse.rateLimitRemaining ??
      repositoryResponse.rateLimitRemaining ??
      userResponse.rateLimitRemaining,
  };
}

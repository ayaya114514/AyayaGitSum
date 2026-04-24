import { unstable_cache } from "next/cache";

import {
  getGitHubOAuthConfig,
  resolveGitHubRequestAuth,
  toGitHubApiHeaders,
  type GitHubRequestAuth,
} from "@/lib/auth";
import { siteConfig } from "@/lib/site";

const GITHUB_API_URL = "https://api.github.com";

type GithubRestUserResponse = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  followers: number;
  following: number;
  public_repos: number;
  company: string | null;
  blog: string;
  location: string | null;
  created_at: string;
};

type GithubRestRepoResponse = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  homepage: string | null;
  topics?: string[];
  archived: boolean;
  fork: boolean;
  size: number;
  visibility: string;
  default_branch: string;
};

type GithubRestCommitResponse = {
  sha: string;
  commit: {
    author: {
      date: string | null;
    } | null;
  };
};

type GithubGraphqlError = {
  type?: string;
  message: string;
  path?: string[];
};

type GithubContributionQueryResult = {
  user: {
    id: string;
    login: string;
    contributionsCollection: {
      contributionYears: number[];
      contributionCalendar: {
        totalContributions: number;
        weeks: {
          firstDay: string;
          contributionDays: {
            contributionCount: number;
            date: string;
            weekday: number;
          }[];
        }[];
      };
      commitContributionsByRepository: {
        repository: {
          name: string;
          nameWithOwner: string;
          url: string;
          stargazerCount: number;
          defaultBranchRef: {
            name: string;
          } | null;
          primaryLanguage: {
            name: string;
            color: string | null;
          } | null;
        };
        contributions: {
          nodes: {
            occurredAt: string;
            commitCount: number;
          }[];
        };
      }[];
    };
  } | null;
};

export type RateLimitSnapshot = {
  source: "rest" | "graphql";
  limit: number | null;
  remaining: number | null;
  used: number | null;
  resetAt: string | null;
  resource: string | null;
};

export type GitHubUser = {
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  company: string | null;
  blog: string;
  location: string | null;
  createdAt: string;
};

export type GitHubRepo = {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  updatedAt: string;
  homepage: string | null;
  topics: string[];
  archived: boolean;
  fork: boolean;
  size: number;
  visibility: string;
  defaultBranch: string;
};

export type GitHubUserSnapshot = {
  user: GitHubUser;
  repos: GitHubRepo[];
  rateLimit: RateLimitSnapshot | null;
};

export type ContributionDay = {
  contributionCount: number;
  date: string;
  weekday: number;
};

export type ContributionWeek = {
  firstDay: string;
  contributionDays: ContributionDay[];
};

export type ContributionRepository = {
  name: string;
  nameWithOwner: string;
  url: string;
  stargazerCount: number;
  defaultBranch: string | null;
  primaryLanguage: string | null;
  primaryLanguageColor: string | null;
  contributionDays: {
    occurredAt: string;
    commitCount: number;
  }[];
};

export type GitHubContributionData = {
  userId: string;
  login: string;
  contributionYears: number[];
  totalContributions: number;
  weeks: ContributionWeek[];
  repositories: ContributionRepository[];
  rateLimit: RateLimitSnapshot | null;
};

export type CommitActivitySample = {
  sha: string;
  repo: string;
  committedDate: string;
};

export type CommitActivitySnapshot = {
  samples: CommitActivitySample[];
  rateLimit: RateLimitSnapshot | null;
};

export type GitHubRequestOptions = {
  userToken?: string;
};

type GitHubErrorKind = "api" | "missing-token" | "not-found" | "rate-limit";

export class GitHubApiError extends Error {
  kind: GitHubErrorKind;
  status: number;
  source: "rest" | "graphql";
  resetAt: string | null;

  constructor(
    message: string,
    options: {
      kind: GitHubErrorKind;
      status: number;
      source: "rest" | "graphql";
      resetAt?: string | null;
    },
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.source = options.source;
    this.resetAt = options.resetAt ?? null;
  }
}

function toRateLimitSnapshot(
  headers: Headers,
  source: "rest" | "graphql",
): RateLimitSnapshot {
  const resetValue = headers.get("x-ratelimit-reset");
  const resetAt = resetValue
    ? new Date(Number(resetValue) * 1000).toISOString()
    : null;

  return {
    source,
    limit: parseNumber(headers.get("x-ratelimit-limit")),
    remaining: parseNumber(headers.get("x-ratelimit-remaining")),
    used: parseNumber(headers.get("x-ratelimit-used")),
    resetAt,
    resource: headers.get("x-ratelimit-resource"),
  };
}

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getGithubHeaders(
  auth: GitHubRequestAuth,
  extraHeaders?: HeadersInit,
): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": siteConfig.githubApiVersion,
    ...toGitHubApiHeaders(auth, extraHeaders),
  };
}

function resolveRequestAuth(userToken?: string) {
  const config = getGitHubOAuthConfig();

  return resolveGitHubRequestAuth({
    userToken,
    serverToken: config.serverToken,
    oauthClientId: config.clientId,
    oauthClientSecret: config.clientSecret,
  });
}

function isRateLimited(message: string | undefined, rateLimit: RateLimitSnapshot) {
  return (
    rateLimit.remaining === 0 ||
    message?.toLowerCase().includes("rate limit") ||
    message?.toLowerCase().includes("secondary rate limit")
  );
}

function lowestRemainingRateLimit(
  rateLimits: Array<RateLimitSnapshot | null | undefined>,
) {
  return rateLimits
    .filter((value): value is RateLimitSnapshot => Boolean(value))
    .reduce<RateLimitSnapshot | null>((lowest, current) => {
      if (!lowest) {
        return current;
      }

      const currentRemaining = current.remaining ?? Number.POSITIVE_INFINITY;
      const lowestRemaining = lowest.remaining ?? Number.POSITIVE_INFINITY;

      return currentRemaining < lowestRemaining ? current : lowest;
    }, null);
}

async function githubRest<T>(path: string, auth: GitHubRequestAuth): Promise<{
  data: T;
  rateLimit: RateLimitSnapshot;
}> {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    headers: getGithubHeaders(auth),
    cache: "no-store",
  });

  const rateLimit = toRateLimitSnapshot(response.headers, "rest");
  const payload = (await response.json()) as T & {
    message?: string;
  };

  if (!response.ok || isRateLimited(payload.message, rateLimit)) {
    if (response.status === 404) {
      throw new GitHubApiError("GitHub 用户不存在。", {
        kind: "not-found",
        status: 404,
        source: "rest",
        resetAt: rateLimit.resetAt,
      });
    }

    if (response.status === 403 || response.status === 429 || isRateLimited(payload.message, rateLimit)) {
      throw new GitHubApiError(
        payload.message || "GitHub API 请求超出频率限制，请稍后重试。",
        {
          kind: "rate-limit",
          status: response.status,
          source: "rest",
          resetAt: rateLimit.resetAt,
        },
      );
    }

    throw new GitHubApiError(payload.message || "GitHub REST API 请求失败。", {
      kind: "api",
      status: response.status,
      source: "rest",
      resetAt: rateLimit.resetAt,
    });
  }

  return {
    data: payload as T,
    rateLimit,
  };
}

async function githubGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
  auth: GitHubRequestAuth,
) {
  if (auth.mode === "anonymous") {
    throw new GitHubApiError("缺少 GitHub 鉴权，无法调用 GitHub GraphQL API。", {
      kind: "missing-token",
      status: 401,
      source: "graphql",
    });
  }

  const response = await fetch(`${GITHUB_API_URL}/graphql`, {
    method: "POST",
    headers: getGithubHeaders(auth),
    cache: "no-store",
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const rateLimit = toRateLimitSnapshot(response.headers, "graphql");
  const payload = (await response.json()) as {
    data?: T;
    errors?: GithubGraphqlError[];
    message?: string;
  };

  const firstError: GithubGraphqlError | undefined = payload.errors?.[0];

  const firstErrorMessage = firstError ? firstError.message : undefined;

  if (!response.ok || firstError || isRateLimited(firstErrorMessage, rateLimit)) {
    if (firstError?.type === "NOT_FOUND") {
      throw new GitHubApiError("GitHub 用户不存在。", {
        kind: "not-found",
        status: 404,
        source: "graphql",
        resetAt: rateLimit.resetAt,
      });
    }

    if (
      response.status === 403 ||
      response.status === 429 ||
      isRateLimited(firstErrorMessage, rateLimit)
    ) {
      throw new GitHubApiError(
        firstErrorMessage || "GitHub GraphQL API 请求超出频率限制。",
        {
          kind: "rate-limit",
          status: response.status || 403,
          source: "graphql",
          resetAt: rateLimit.resetAt,
        },
      );
    }

    throw new GitHubApiError(
      firstErrorMessage || payload.message || "GitHub GraphQL API 请求失败。",
      {
        kind: "api",
        status: response.status || 500,
        source: "graphql",
        resetAt: rateLimit.resetAt,
      },
    );
  }

  return {
    data: payload.data as T,
    rateLimit,
  };
}

function mapUser(user: GithubRestUserResponse): GitHubUser {
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url,
    bio: user.bio,
    followers: user.followers,
    following: user.following,
    publicRepos: user.public_repos,
    company: user.company,
    blog: user.blog,
    location: user.location,
    createdAt: user.created_at,
  };
}

function mapRepo(repo: GithubRestRepoResponse): GitHubRepo {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    updatedAt: repo.updated_at,
    homepage: repo.homepage,
    topics: repo.topics ?? [],
    archived: repo.archived,
    fork: repo.fork,
    size: repo.size,
    visibility: repo.visibility,
    defaultBranch: repo.default_branch,
  };
}

async function getGitHubUserSnapshotInternal(
  username: string,
  auth: GitHubRequestAuth,
): Promise<GitHubUserSnapshot> {
  const encodedUsername = encodeURIComponent(username);

  // Fire the user profile and the first repo page in parallel — we need
  // public_repos to know how many remaining pages to fetch.
  const [userResult, firstRepoPage] = await Promise.all([
    githubRest<GithubRestUserResponse>(`/users/${encodedUsername}`, auth),
    githubRest<GithubRestRepoResponse[]>(
      `/users/${encodedUsername}/repos?type=owner&sort=updated&per_page=100&page=1`,
      auth,
    ),
  ]);

  const rateLimits: RateLimitSnapshot[] = [
    userResult.rateLimit,
    firstRepoPage.rateLimit,
  ];
  const repos: GitHubRepo[] = firstRepoPage.data.map(mapRepo);

  const totalPages = Math.min(
    10,
    Math.ceil(userResult.data.public_repos / 100),
  );

  if (totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        githubRest<GithubRestRepoResponse[]>(
          `/users/${encodedUsername}/repos?type=owner&sort=updated&per_page=100&page=${index + 2}`,
          auth,
        ),
      ),
    );

    for (const page of remainingPages) {
      rateLimits.push(page.rateLimit);
      repos.push(...page.data.map(mapRepo));
    }
  }

  return {
    user: mapUser(userResult.data),
    repos,
    rateLimit: lowestRemainingRateLimit(rateLimits),
  };
}

const USER_CONTRIBUTIONS_QUERY = `
  query UserContributionSnapshot($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      id
      login
      contributionsCollection(from: $from, to: $to) {
        contributionYears
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 12) {
          repository {
            name
            nameWithOwner
            url
            stargazerCount
            defaultBranchRef {
              name
            }
            primaryLanguage {
              name
              color
            }
          }
          contributions(first: 100) {
            nodes {
              occurredAt
              commitCount
            }
          }
        }
      }
    }
  }
`;

async function getGitHubContributionDataInternal(
  username: string,
  auth: GitHubRequestAuth,
): Promise<GitHubContributionData> {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setFullYear(now.getFullYear() - 1);

  const result = await githubGraphql<GithubContributionQueryResult>(
    USER_CONTRIBUTIONS_QUERY,
    {
      username,
      from: yearAgo.toISOString(),
      to: now.toISOString(),
    },
    auth,
  );

  if (!result.data.user) {
    throw new GitHubApiError("GitHub 用户不存在。", {
      kind: "not-found",
      status: 404,
      source: "graphql",
      resetAt: result.rateLimit.resetAt,
    });
  }

  const { user } = result.data;
  const collection = user.contributionsCollection;

  return {
    userId: user.id,
    login: user.login,
    contributionYears: collection.contributionYears,
    totalContributions: collection.contributionCalendar.totalContributions,
    weeks: collection.contributionCalendar.weeks,
    repositories: collection.commitContributionsByRepository.map((entry) => ({
      name: entry.repository.name,
      nameWithOwner: entry.repository.nameWithOwner,
      url: entry.repository.url,
      stargazerCount: entry.repository.stargazerCount,
      defaultBranch: entry.repository.defaultBranchRef?.name ?? null,
      primaryLanguage: entry.repository.primaryLanguage?.name ?? null,
      primaryLanguageColor: entry.repository.primaryLanguage?.color ?? null,
      contributionDays: entry.contributions.nodes,
    })),
    rateLimit: result.rateLimit,
  };
}

async function getGitHubCommitActivitySampleInternal(
  username: string,
  repositories: ContributionRepository[],
  auth: GitHubRequestAuth,
): Promise<CommitActivitySnapshot> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceIso = since.toISOString();

  const repoCandidates = [...repositories]
    .sort((left, right) => {
      const leftCount = left.contributionDays.reduce(
        (total, day) => total + day.commitCount,
        0,
      );
      const rightCount = right.contributionDays.reduce(
        (total, day) => total + day.commitCount,
        0,
      );

      return rightCount - leftCount;
    })
    .slice(0, 6);

  // Fan out per-repo fetches in parallel. Each repo still fetches its two
  // pages sequentially (page 2 is conditional on page 1 being full).
  const perRepoResults = await Promise.all(
    repoCandidates.map(async (repo) => {
      const [owner, name] = repo.nameWithOwner.split("/");
      const pages: Array<{
        commits: GithubRestCommitResponse[];
        rateLimit: RateLimitSnapshot;
      }> = [];

      for (let page = 1; page <= 2; page += 1) {
        const result = await githubRest<GithubRestCommitResponse[]>(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
            name,
          )}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(
            sinceIso,
          )}&per_page=100&page=${page}`,
          auth,
        );

        pages.push({ commits: result.data, rateLimit: result.rateLimit });

        if (result.data.length < 100) {
          break;
        }
      }

      return { repo, pages };
    }),
  );

  const samples: CommitActivitySample[] = [];
  const seenShas = new Set<string>();
  const rateLimits: RateLimitSnapshot[] = [];

  for (const { repo, pages } of perRepoResults) {
    for (const page of pages) {
      rateLimits.push(page.rateLimit);

      for (const commit of page.commits) {
        const committedDate = commit.commit.author?.date;

        if (!committedDate || seenShas.has(commit.sha)) {
          continue;
        }

        seenShas.add(commit.sha);
        samples.push({
          sha: commit.sha,
          repo: repo.nameWithOwner,
          committedDate,
        });
      }
    }
  }

  return {
    samples: samples.slice(0, 500),
    rateLimit: lowestRemainingRateLimit(rateLimits),
  };
}

export function getGitHubUserSnapshot(
  username: string,
  options: GitHubRequestOptions = {},
) {
  const normalizedUsername = username.trim().toLowerCase();
  const auth = resolveRequestAuth(options.userToken);

  if (auth.mode === "user-token") {
    return getGitHubUserSnapshotInternal(normalizedUsername, auth);
  }

  return unstable_cache(
    () => getGitHubUserSnapshotInternal(normalizedUsername, auth),
    [`gitpulse-user-snapshot:${normalizedUsername}`],
    {
      revalidate: 60 * 30,
      tags: [`gitpulse-user:${normalizedUsername}`],
    },
  )();
}

export function getGitHubContributionData(
  username: string,
  options: GitHubRequestOptions = {},
) {
  const normalizedUsername = username.trim().toLowerCase();
  const auth = resolveRequestAuth(options.userToken);

  if (auth.mode === "user-token") {
    return getGitHubContributionDataInternal(normalizedUsername, auth);
  }

  return unstable_cache(
    () => getGitHubContributionDataInternal(normalizedUsername, auth),
    [`gitpulse-contributions:${normalizedUsername}`],
    {
      revalidate: 60 * 30,
      tags: [`gitpulse-contributions:${normalizedUsername}`],
    },
  )();
}

export function getGitHubCommitActivitySample(
  username: string,
  repositories: ContributionRepository[],
  options: GitHubRequestOptions = {},
) {
  const normalizedUsername = username.trim().toLowerCase();
  const auth = resolveRequestAuth(options.userToken);
  const cacheKey = repositories
    .map((repository) => repository.nameWithOwner)
    .sort()
    .join("|");

  if (auth.mode === "user-token") {
    return getGitHubCommitActivitySampleInternal(
      normalizedUsername,
      repositories,
      auth,
    );
  }

  return unstable_cache(
    () =>
      getGitHubCommitActivitySampleInternal(normalizedUsername, repositories, auth),
    [`gitpulse-commit-activity:${normalizedUsername}:${cacheKey}`],
    {
      revalidate: 60 * 30,
      tags: [`gitpulse-commit-activity:${normalizedUsername}`],
    },
  )();
}

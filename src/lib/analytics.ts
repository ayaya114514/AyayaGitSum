import { differenceInCalendarDays, formatDistanceToNowStrict, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

import type {
  CommitActivitySample,
  GitHubContributionData,
  GitHubRepo,
  GitHubUser,
} from "@/lib/github";
import { getLanguageColor } from "@/lib/site";

type LanguageBucket = {
  name: string;
  value: number;
  stars: number;
  color: string;
};

type RepoCategory = {
  label: string;
  value: number;
};

export type HabitTag = {
  label: string;
  description: string;
};

export type ActivityHighlight = {
  peakHour: number;
  peakHourLabel: string;
  busiestDay: number;
  busiestDayLabel: string;
  commitSampleCount: number;
};

export type DashboardAnalytics = {
  totalStars: number;
  totalForks: number;
  activeReposLast90Days: number;
  lastUpdatedLabel: string;
  languageBreakdown: LanguageBucket[];
  topRepositories: GitHubRepo[];
  repoCategories: RepoCategory[];
  habitTags: HabitTag[];
  activityMatrix: number[][];
  activityHighlight: ActivityHighlight | null;
  timezone: string;
};

const DEFAULT_TIMEZONE = "Asia/Shanghai";

const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const repoTypeRules = [
  {
    label: "Web 应用",
    keywords: [
      "next",
      "react",
      "vue",
      "frontend",
      "tailwind",
      "nuxt",
      "web",
    ],
  },
  {
    label: "AI / 数据",
    keywords: [
      "ai",
      "llm",
      "rag",
      "agent",
      "model",
      "dataset",
      "data",
      "ml",
    ],
  },
  {
    label: "工具链",
    keywords: ["cli", "sdk", "plugin", "tool", "vscode", "extension", "devops"],
  },
  {
    label: "服务端",
    keywords: ["api", "server", "backend", "express", "nest", "go", "rust"],
  },
  {
    label: "移动端",
    keywords: ["ios", "android", "react native", "flutter", "swift", "kotlin"],
  },
];

export function buildDashboardAnalytics(
  user: GitHubUser,
  repos: GitHubRepo[],
  commits: CommitActivitySample[],
  timezone: string = DEFAULT_TIMEZONE,
): DashboardAnalytics {
  const totalStars = repos.reduce((total, repo) => total + repo.stargazersCount, 0);
  const totalForks = repos.reduce((total, repo) => total + repo.forksCount, 0);
  const activeReposLast90Days = repos.filter(
    (repo) => differenceInCalendarDays(new Date(), parseISO(repo.updatedAt)) <= 90,
  ).length;

  const sortedByUpdate = [...repos].sort(
    (left, right) =>
      parseISO(right.updatedAt).getTime() - parseISO(left.updatedAt).getTime(),
  );

  const languageBreakdown = groupLanguages(repos);
  const topRepositories = [...repos]
    .sort((left, right) => {
      if (right.stargazersCount !== left.stargazersCount) {
        return right.stargazersCount - left.stargazersCount;
      }

      return (
        parseISO(right.updatedAt).getTime() - parseISO(left.updatedAt).getTime()
      );
    })
    .slice(0, 8);

  const repoCategories = inferRepositoryCategories(repos);
  const activityMatrix = buildActivityMatrix(commits, timezone);
  const activityHighlight = summarizeActivity(commits, activityMatrix);
  const habitTags = inferHabitTags({
    repos,
    languageBreakdown,
    activityMatrix,
    activityHighlight,
    activeReposLast90Days,
  });

  return {
    totalStars,
    totalForks,
    activeReposLast90Days,
    lastUpdatedLabel: sortedByUpdate[0]
      ? formatDistanceToNowStrict(parseISO(sortedByUpdate[0].updatedAt), {
          addSuffix: true,
          locale: zhCN,
        })
      : "暂无更新",
    languageBreakdown,
    topRepositories,
    repoCategories,
    habitTags,
    activityMatrix,
    activityHighlight,
    timezone,
  };
}

function groupLanguages(repos: GitHubRepo[]) {
  const buckets = new Map<string, LanguageBucket>();

  for (const repo of repos) {
    const name = repo.language ?? "Unknown";
    const existing = buckets.get(name);

    if (existing) {
      existing.value += 1;
      existing.stars += repo.stargazersCount;
      continue;
    }

    buckets.set(name, {
      name,
      value: 1,
      stars: repo.stargazersCount,
      color: getLanguageColor(name),
    });
  }

  const sorted = Array.from(buckets.values()).sort(
    (left, right) => right.value - left.value,
  );

  if (sorted.length <= 6) {
    return sorted;
  }

  const primary = sorted.slice(0, 5);
  const remaining = sorted.slice(5);

  primary.push({
    name: "Other",
    value: remaining.reduce((total, item) => total + item.value, 0),
    stars: remaining.reduce((total, item) => total + item.stars, 0),
    color: "#94a3b8",
  });

  return primary;
}

function inferRepositoryCategories(repos: GitHubRepo[]) {
  const counters = new Map<string, number>();

  for (const repo of repos) {
    const searchCorpus = [
      repo.name,
      repo.description ?? "",
      repo.language ?? "",
      ...repo.topics,
    ]
      .join(" ")
      .toLowerCase();

    for (const rule of repoTypeRules) {
      if (rule.keywords.some((keyword) => searchCorpus.includes(keyword))) {
        counters.set(rule.label, (counters.get(rule.label) ?? 0) + 1);
      }
    }
  }

  if (counters.size === 0) {
    return [{ label: "实验项目", value: repos.length }];
  }

  return Array.from(counters.entries())
    .map(([label, value]) => ({
      label,
      value,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 4);
}

function buildActivityMatrix(
  commits: CommitActivitySample[],
  timezone: string,
) {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const weekdayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  for (const commit of commits) {
    const date = new Date(commit.committedDate);
    const rawHour = Number(hourFormatter.format(date));
    const hour = Number.isFinite(rawHour) ? rawHour % 24 : 0;
    const weekday = weekdayIndex[weekdayFormatter.format(date)] ?? 0;
    matrix[weekday][hour] += 1;
  }

  return matrix;
}

function summarizeActivity(commits: CommitActivitySample[], matrix: number[][]) {
  if (commits.length === 0) {
    return null;
  }

  let peakHour = 0;
  let peakHourCount = -1;
  let busiestDay = 0;
  let busiestDayCount = -1;

  for (let hour = 0; hour < 24; hour += 1) {
    const hourCount = matrix.reduce((total, dayRow) => total + dayRow[hour], 0);

    if (hourCount > peakHourCount) {
      peakHourCount = hourCount;
      peakHour = hour;
    }
  }

  for (let day = 0; day < 7; day += 1) {
    const dayCount = matrix[day].reduce((total, value) => total + value, 0);

    if (dayCount > busiestDayCount) {
      busiestDayCount = dayCount;
      busiestDay = day;
    }
  }

  return {
    peakHour,
    peakHourLabel: `${String(peakHour).padStart(2, "0")}:00`,
    busiestDay,
    busiestDayLabel: weekdayLabels[busiestDay],
    commitSampleCount: commits.length,
  };
}

function inferHabitTags({
  repos,
  languageBreakdown,
  activityMatrix,
  activityHighlight,
  activeReposLast90Days,
}: {
  repos: GitHubRepo[];
  languageBreakdown: LanguageBucket[];
  activityMatrix: number[][];
  activityHighlight: ActivityHighlight | null;
  activeReposLast90Days: number;
}) {
  const tags: HabitTag[] = [];
  const totalCommits = activityMatrix.flat().reduce((total, value) => total + value, 0);
  const weekendCommits =
    activityMatrix[0].reduce((total, value) => total + value, 0) +
    activityMatrix[6].reduce((total, value) => total + value, 0);
  const nightCommits = activityMatrix.reduce(
    (total, dayRow) =>
      total + dayRow.slice(0, 5).reduce((sum, value) => sum + value, 0) + dayRow[22] + dayRow[23],
    0,
  );

  const dominantLanguage = languageBreakdown[0];

  if (activityHighlight && (activityHighlight.peakHour >= 22 || activityHighlight.peakHour <= 4)) {
    tags.push({
      label: "夜猫子",
      description: `高峰时段集中在 ${activityHighlight.peakHourLabel} 左右。`,
    });
  } else if (activityHighlight && activityHighlight.peakHour >= 6 && activityHighlight.peakHour <= 9) {
    tags.push({
      label: "清晨开工",
      description: `最常见的提交窗口出现在 ${activityHighlight.peakHourLabel}。`,
    });
  }

  if (totalCommits > 0 && weekendCommits / totalCommits >= 0.3) {
    tags.push({
      label: "周末战士",
      description: "周末仍保持较高提交密度，属于持续推进型节奏。",
    });
  }

  if (dominantLanguage && dominantLanguage.name === "TypeScript" && dominantLanguage.value / Math.max(repos.length, 1) >= 0.35) {
    tags.push({
      label: "TypeScript 狂热者",
      description: "仓库语言分布明显向 TypeScript 倾斜。",
    });
  }

  if (activeReposLast90Days >= Math.max(3, Math.ceil(repos.length * 0.35))) {
    tags.push({
      label: "持续冲刺",
      description: "最近 90 天仍有不少仓库保持更新。",
    });
  }

  if (totalCommits > 0 && nightCommits / totalCommits >= 0.35) {
    tags.push({
      label: "深夜专注流",
      description: "夜间提交占比偏高，容易在长时间专注中产出。",
    });
  }

  if (tags.length === 0) {
    tags.push({
      label: "稳定输出",
      description: "节奏均衡，仓库更新与提交分布都比较平滑。",
    });
  }

  return tags.slice(0, 4);
}

export function buildAiInputSummary(
  user: GitHubUser,
  analytics: DashboardAnalytics,
  contributions: GitHubContributionData | null,
) {
  return {
    login: user.login,
    name: user.name,
    totalStars: analytics.totalStars,
    publicRepos: user.publicRepos,
    activeReposLast90Days: analytics.activeReposLast90Days,
    lastUpdatedLabel: analytics.lastUpdatedLabel,
    languages: analytics.languageBreakdown.map((language) => ({
      name: language.name,
      repoCount: language.value,
      stars: language.stars,
    })),
    repoCategories: analytics.repoCategories,
    habits: analytics.habitTags.map((habit) => habit.label),
    totalContributions: contributions?.totalContributions ?? null,
    contributionYears: contributions?.contributionYears ?? [],
    activityHighlight: analytics.activityHighlight
      ? {
          peakHourLabel: analytics.activityHighlight.peakHourLabel,
          busiestDayLabel: analytics.activityHighlight.busiestDayLabel,
          commitSampleCount: analytics.activityHighlight.commitSampleCount,
        }
      : null,
  };
}

export function formatRelativeDate(dateString: string) {
  return formatDistanceToNowStrict(parseISO(dateString), {
    addSuffix: true,
    locale: zhCN,
  });
}

export function getWeekdayLabel(index: number) {
  return weekdayLabels[index] ?? weekdayLabels[0];
}

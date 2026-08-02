import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  GitHubRepository,
  GitHubUser,
  ProfileAnalysis,
} from "../types";
import { ProfileView } from "./ProfileView";

const user: GitHubUser = {
  login: "example",
  name: "Example User",
  avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
  html_url: "https://github.com/example",
  bio: "Builds small tools.",
  company: null,
  blog: "",
  location: null,
  public_repos: 150,
  followers: 12,
  following: 3,
  created_at: "2020-01-01T00:00:00Z",
};

const repository: GitHubRepository = {
  id: 1,
  name: "local-tool",
  html_url: "https://github.com/example/local-tool",
  description: null,
  language: "TypeScript",
  stargazers_count: 8,
  forks_count: 1,
  fork: false,
  archived: false,
  pushed_at: "2026-08-01T00:00:00Z",
  topics: [],
};

const analysis: ProfileAnalysis = {
  user,
  repositories: [repository],
  repositoryCoverage: {
    fetchedCount: 100,
    reportedTotal: 150,
    isComplete: false,
    reason: "page-limit",
  },
  topRepositories: [repository],
  languages: [{ name: "TypeScript", count: 1, percentage: 100 }],
  activityByDay: [
    { day: "周日", count: 0 },
    { day: "周一", count: 2 },
    { day: "周二", count: 0 },
    { day: "周三", count: 0 },
    { day: "周四", count: 0 },
    { day: "周五", count: 0 },
    { day: "周六", count: 0 },
  ],
  recentEvents: [],
  eventsAvailable: true,
  totalStars: 8,
  originalRepositoryCount: 1,
  summary: "这是应当显示在页面上的本地总结。",
  warnings: ["本次仅分析最近更新的仓库样本。"],
  rateLimit: {
    remaining: 42,
    resetAt: null,
    retryAfterSeconds: null,
  },
};

describe("ProfileView", () => {
  it("renders the local summary and makes partial coverage explicit", () => {
    const markup = renderToStaticMarkup(
      <ProfileView
        analysis={analysis}
        loading={false}
        onSearch={() => undefined}
      />,
    );

    expect(markup).toContain("本地规则生成 · 不调用 AI");
    expect(markup).toContain(analysis.summary);
    expect(markup).toContain(
      "仓库统计基于本次读取的 100 / 150 个公开仓库样本。",
    );
    expect(markup).toContain(analysis.warnings[0]);
  });

  it("exposes local-time activity counts without inventing a zero bar", () => {
    const markup = renderToStaticMarkup(
      <ProfileView
        analysis={analysis}
        loading={false}
        onSearch={() => undefined}
      />,
    );

    expect(markup).toContain("浏览器本地时区");
    expect(markup).toContain('aria-label="周日：0 条公开活动"');
    expect(markup).toContain("height:0%");
  });

  it("does not present missing repository details as zero totals", () => {
    const markup = renderToStaticMarkup(
      <ProfileView
        analysis={{
          ...analysis,
          repositories: [],
          repositoryCoverage: {
            fetchedCount: 0,
            reportedTotal: 150,
            isComplete: false,
            reason: "request-failed",
          },
          topRepositories: [],
          languages: [],
          totalStars: 0,
          originalRepositoryCount: 0,
        }}
        loading={false}
        onSearch={() => undefined}
      />,
    );

    expect(markup.match(/<strong>—<\/strong>/g)).toHaveLength(2);
    expect(markup).toContain("仓库详情暂时不可用。");
  });
});

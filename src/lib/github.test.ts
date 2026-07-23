import { describe, expect, it } from "vitest";
import {
  createSummary,
  getActivityByDay,
  getLanguageShares,
  getTopRepositories,
  normalizeUsername,
} from "./github";
import type { GitHubEvent, GitHubRepository, GitHubUser } from "../types";

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

const user: GitHubUser = {
  login: "example",
  name: "Example User",
  avatar_url: "",
  html_url: "https://github.com/example",
  bio: null,
  company: null,
  blog: "",
  location: null,
  public_repos: 3,
  followers: 0,
  following: 0,
  created_at: "2020-01-01T00:00:00Z",
};

describe("GitHub data helpers", () => {
  it("normalizes usernames", () => {
    expect(normalizeUsername("  @@octocat ")).toBe("octocat");
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

  it("groups activity and creates a local summary", () => {
    const events: GitHubEvent[] = [
      {
        id: "1",
        type: "PushEvent",
        repo: { name: "example/one" },
        payload: {},
        created_at: "2026-07-20T12:00:00Z",
      },
    ];
    expect(
      getActivityByDay(events).find((item) => item.day === "周一")?.count,
    ).toBe(1);
    expect(
      createSummary(
        user,
        [repository("one", "TypeScript", 1)],
        [{ name: "TypeScript", count: 1, percentage: 100 }],
        events,
      ),
    ).toContain("最常见的主要语言是 TypeScript");
  });
});

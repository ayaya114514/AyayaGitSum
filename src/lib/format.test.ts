import { describe, expect, it } from "vitest";
import type { GitHubEvent } from "../types";
import {
  describeEvent,
  describeRequestError,
  formatRelativeDate,
} from "./format";
import { GitHubApiError } from "./github";

const event = (
  type: string,
  payload: GitHubEvent["payload"] = {},
): GitHubEvent => ({
  id: "1",
  type,
  repo: { name: "example/one" },
  payload,
  created_at: "2026-07-20T12:00:00Z",
});

describe("describeEvent", () => {
  it("does not invent commit counts for current PushEvent payloads", () => {
    expect(describeEvent(event("PushEvent", { ref: "refs/heads/main" }))).toBe(
      "向 example/one 的 main 分支推送了代码",
    );
    expect(describeEvent(event("PushEvent", { ref: "refs/tags/v1.0" }))).toBe(
      "向 example/one 推送了标签 v1.0",
    );
    expect(describeEvent(event("PushEvent"))).toBe("向 example/one 推送了代码");
    expect(describeEvent(event("PushEvent", { size: 3 }))).toBe(
      "向 example/one 推送了 3 个 commit",
    );
  });

  it("translates pull request and issue actions instead of echoing English", () => {
    expect(describeEvent(event("PullRequestEvent", { action: "opened" }))).toBe(
      "创建了 example/one 的 Pull Request",
    );
    expect(describeEvent(event("PullRequestEvent", { action: "merged" }))).toBe(
      "合并了 example/one 的 Pull Request",
    );
    expect(
      describeEvent(
        event("PullRequestEvent", {
          action: "closed",
          pull_request: { merged: true },
        }),
      ),
    ).toBe("合并了 example/one 的 Pull Request");
    expect(describeEvent(event("IssuesEvent", { action: "closed" }))).toBe(
      "关闭了 example/one 的 Issue",
    );
    expect(
      describeEvent(event("IssuesEvent", { action: "some_new_action" })),
    ).toBe("更新了 example/one 的 Issue");
  });

  it("describes refs, repositories, and pull request comments", () => {
    expect(
      describeEvent(event("CreateEvent", { ref_type: "branch", ref: "dev" })),
    ).toBe("在 example/one 创建了分支 dev");
    expect(
      describeEvent(event("CreateEvent", { ref_type: "repository", ref: null })),
    ).toBe("创建了仓库 example/one");
    expect(
      describeEvent(event("DeleteEvent", { ref_type: "tag", ref: "v0" })),
    ).toBe("在 example/one 删除了标签 v0");
    expect(
      describeEvent(
        event("IssueCommentEvent", { issue: { pull_request: {} } }),
      ),
    ).toBe("评论了 example/one 的 Pull Request");
    expect(describeEvent(event("IssueCommentEvent", { issue: {} }))).toBe(
      "评论了 example/one 的 Issue",
    );
  });
});

describe("formatRelativeDate", () => {
  // Local-time constructors keep these cases independent of the test TZ.
  const morning = new Date(2026, 8, 23, 8, 0);
  const lateEvening = new Date(2026, 8, 23, 23, 0);

  it("compares local calendar days instead of rounding hour differences", () => {
    expect(
      formatRelativeDate(new Date(2026, 8, 23, 1, 0).toISOString(), lateEvening),
    ).toBe("今天");
    expect(
      formatRelativeDate(new Date(2026, 8, 22, 23, 0).toISOString(), morning),
    ).toBe("昨天");
    expect(
      formatRelativeDate(new Date(2026, 8, 20, 12, 0).toISOString(), morning),
    ).toBe("3天前");
  });

  it("treats slightly future timestamps as today and ignores invalid input", () => {
    expect(
      formatRelativeDate(new Date(2026, 8, 24, 0, 5).toISOString(), lateEvening),
    ).toBe("今天");
    expect(formatRelativeDate("not a date", morning)).toBe("");
  });
});

describe("describeRequestError", () => {
  it("adds the retry or reset hint to rate-limit errors", () => {
    const retry = new GitHubApiError("额度已用完。", 429, {
      remaining: 0,
      resetAt: null,
      retryAfterSeconds: 60,
    });
    expect(describeRequestError(retry)).toBe("额度已用完。建议 60 秒后重试。");

    const reset = new GitHubApiError("额度已用完。", 403, {
      remaining: 0,
      resetAt: "2026-09-23T12:30:00.000Z",
      retryAfterSeconds: null,
    });
    expect(describeRequestError(reset)).toMatch(/^额度已用完。额度预计 .+ 重置。$/);
  });

  it("leaves other errors unchanged", () => {
    expect(
      describeRequestError(new GitHubApiError("没有找到这个 GitHub 用户。", 404)),
    ).toBe("没有找到这个 GitHub 用户。");
    expect(describeRequestError("boom")).toBe("发生了未知错误，请稍后再试。");
  });
});

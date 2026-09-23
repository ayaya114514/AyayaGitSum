import type { GitHubEvent, GitHubRateLimit } from "../types";
import { isRateLimitError } from "./github";

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function startOfLocalDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

export function formatRelativeDate(value: string, now = new Date()): string {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return "";
  }

  // Compare local calendar days: 01:00 today is "今天" even when viewed at
  // 23:00, and 23:00 yesterday is "昨天" even when viewed at 08:00.
  const differenceInDays = Math.min(
    0,
    Math.round((startOfLocalDay(target) - startOfLocalDay(now)) / 86_400_000),
  );

  if (differenceInDays === 0) {
    return "今天";
  }
  return new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" }).format(
    differenceInDays,
    "day",
  );
}

export function formatResetTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRateLimitHint(rateLimit: GitHubRateLimit): string | null {
  if (rateLimit.retryAfterSeconds !== null) {
    return `建议 ${rateLimit.retryAfterSeconds} 秒后重试。`;
  }
  const resetTime = formatResetTime(rateLimit.resetAt);
  return resetTime ? `额度预计 ${resetTime} 重置。` : null;
}

export function describeRequestError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "发生了未知错误，请稍后再试。";
  }
  const hint = isRateLimitError(error)
    ? formatRateLimitHint(error.rateLimit)
    : null;
  return hint ? `${error.message}${hint}` : error.message;
}

const ACTION_LABELS: Record<string, string> = {
  opened: "创建",
  closed: "关闭",
  reopened: "重新打开",
  merged: "合并",
  edited: "编辑",
  assigned: "指派",
  unassigned: "取消指派",
  labeled: "标记",
  unlabeled: "移除标签",
  review_requested: "请求审查",
  ready_for_review: "标记可审查",
  synchronize: "更新",
};

function actionLabel(action: string | undefined): string {
  return (action && ACTION_LABELS[action]) || "更新";
}

const REF_TYPE_LABELS: Record<string, string> = {
  branch: "分支",
  tag: "标签",
};

function describeRef(event: GitHubEvent): string {
  const refType = event.payload.ref_type ?? "";
  const label = REF_TYPE_LABELS[refType] ?? "引用";
  return event.payload.ref ? `${label} ${event.payload.ref}` : label;
}

function describePush(event: GitHubEvent, repository: string): string {
  const { size, ref } = event.payload;
  if (typeof size === "number") {
    return `向 ${repository} 推送了 ${size} 个 commit`;
  }
  if (ref?.startsWith("refs/heads/")) {
    return `向 ${repository} 的 ${ref.slice("refs/heads/".length)} 分支推送了代码`;
  }
  if (ref?.startsWith("refs/tags/")) {
    return `向 ${repository} 推送了标签 ${ref.slice("refs/tags/".length)}`;
  }
  return `向 ${repository} 推送了代码`;
}

export function describeEvent(event: GitHubEvent): string {
  const repository = event.repo.name;
  switch (event.type) {
    case "PushEvent":
      return describePush(event, repository);
    case "PullRequestEvent": {
      const merged =
        event.payload.action === "closed" &&
        event.payload.pull_request?.merged === true;
      return `${merged ? "合并" : actionLabel(event.payload.action)}了 ${repository} 的 Pull Request`;
    }
    case "IssuesEvent":
      return `${actionLabel(event.payload.action)}了 ${repository} 的 Issue`;
    case "CreateEvent":
      return event.payload.ref_type === "repository"
        ? `创建了仓库 ${repository}`
        : `在 ${repository} 创建了${describeRef(event)}`;
    case "DeleteEvent":
      return `在 ${repository} 删除了${describeRef(event)}`;
    case "ForkEvent":
      return `Fork 了 ${repository}`;
    case "WatchEvent":
      return `Star 了 ${repository}`;
    case "ReleaseEvent":
      return `在 ${repository} 发布了 Release`;
    case "PublicEvent":
      return `公开了仓库 ${repository}`;
    case "IssueCommentEvent":
      return event.payload.issue?.pull_request
        ? `评论了 ${repository} 的 Pull Request`
        : `评论了 ${repository} 的 Issue`;
    case "PullRequestReviewEvent":
      return `审查了 ${repository} 的 Pull Request`;
    case "PullRequestReviewCommentEvent":
      return `评论了 ${repository} 的 Pull Request 代码`;
    default:
      return `在 ${repository} 产生了公开活动`;
  }
}

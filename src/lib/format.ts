import type { GitHubEvent } from "../types";

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

export function formatRelativeDate(value: string): string {
  const target = new Date(value).getTime();
  const differenceInDays = Math.round((target - Date.now()) / 86_400_000);

  if (Math.abs(differenceInDays) < 1) {
    return "今天";
  }
  return new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" }).format(
    differenceInDays,
    "day",
  );
}

export function describeEvent(event: GitHubEvent): string {
  const repository = event.repo.name;
  switch (event.type) {
    case "PushEvent":
      return `向 ${repository} 推送了 ${event.payload.size ?? 1} 个 commit`;
    case "PullRequestEvent":
      return `${event.payload.action ?? "更新"}了 ${repository} 的 Pull Request`;
    case "IssuesEvent":
      return `${event.payload.action ?? "更新"}了 ${repository} 的 Issue`;
    case "CreateEvent":
      return `在 ${repository} 创建了 ${event.payload.ref_type ?? "内容"}`;
    case "ForkEvent":
      return `Fork 了 ${repository}`;
    case "WatchEvent":
      return `Star 了 ${repository}`;
    case "IssueCommentEvent":
      return `评论了 ${repository} 的 Issue`;
    default:
      return `在 ${repository} 产生了公开活动`;
  }
}

import type { GitHubAuthMode } from "@/lib/auth";
import { GitHubApiError } from "@/lib/github";

export type StatusNotice = {
  title: string;
  description: string;
};

type GetStatusNoticeOptions = {
  authMode?: GitHubAuthMode;
  hasGithubToken?: boolean;
};

export function getStatusNotice(
  error: unknown,
  options: GetStatusNoticeOptions = {},
): StatusNotice {
  const authMode = resolveAuthMode(options);

  if (error instanceof GitHubApiError) {
    if (error.kind === "not-found") {
      return {
        title: "用户不存在",
        description: "GitHub 上没有找到这个用户名。请检查拼写，或尝试搜索其他用户。",
      };
    }

    if (error.kind === "missing-token") {
      return {
        title: "高级分析暂未启用",
        description:
          "贡献热力图、活跃时段和部分深度分析需要 GitHub 鉴权。请配置 GITHUB_OAUTH_CLIENT_ID 与 GITHUB_OAUTH_CLIENT_SECRET，或提供 GITHUB_TOKEN，然后重启开发服务器。",
      };
    }

    if (error.kind === "rate-limit") {
      if (authMode === "anonymous") {
        return {
          title: "GitHub 匿名额度已耗尽",
          description: error.resetAt
            ? `当前环境未配置 GitHub 鉴权，正在使用 GitHub 匿名 REST 限额（按 IP 共享，通常只有 60 次/小时）。请在 .env.local 中设置 GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET 或 GITHUB_TOKEN 并重启服务。匿名额度将在 ${formatResetTime(
                error.resetAt,
              )}（本地时间）重置。`
            : "当前环境未配置 GitHub 鉴权，正在使用 GitHub 匿名 REST 限额（按 IP 共享，通常只有 60 次/小时）。请在 .env.local 中设置 GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET 或 GITHUB_TOKEN 并重启服务。",
        };
      }

      if (authMode === "oauth-app") {
        return {
          title: "GitHub 应用公共额度已耗尽",
          description: error.resetAt
            ? `当前实例正在使用 GitHub OAuth App 的公共额度（按应用共享）。请在 ${formatResetTime(
                error.resetAt,
              )}（本地时间）后重试，或登录 GitHub 让请求走用户自己的额度。`
            : "当前实例正在使用 GitHub OAuth App 的公共额度（按应用共享）。请稍后重试，或登录 GitHub 让请求走用户自己的额度。",
        };
      }

      if (authMode === "user-token") {
        return {
          title: "当前登录账号的 GitHub 配额已耗尽",
          description: error.resetAt
            ? `当前请求使用的是登录 GitHub 账号自己的额度，请在 ${formatResetTime(
                error.resetAt,
              )}（本地时间）后重试，或退出登录后切回公共模式。`
            : "当前请求使用的是登录 GitHub 账号自己的额度，请稍后重试，或退出登录后切回公共模式。",
        };
      }

      if (authMode === "server-token") {
        return {
          title: "服务器 GitHub 令牌额度已耗尽",
          description: error.resetAt
            ? `当前实例正在使用服务器侧 GitHub 令牌，请在 ${formatResetTime(
                error.resetAt,
              )}（本地时间）后重试，或改用 GitHub OAuth 登录来分摊到用户自己的额度。`
            : "当前实例正在使用服务器侧 GitHub 令牌，请稍后重试，或改用 GitHub OAuth 登录来分摊到用户自己的额度。",
        };
      }

      return {
        title: "GitHub 请求超限",
        description: error.resetAt
          ? `当前请求已触发 GitHub API 速率限制，请在 ${formatResetTime(error.resetAt)}（本地时间）后重试。`
          : "当前请求已触发 GitHub API 速率限制，请稍后再试。",
      };
    }
  }

  return {
    title: "页面加载失败",
    description: "发生了未预期的错误。你可以重试，或者换一个用户名继续查询。",
  };
}

function resolveAuthMode(options: GetStatusNoticeOptions): GitHubAuthMode {
  if (options.authMode) {
    return options.authMode;
  }

  if (options.hasGithubToken === false) {
    return "anonymous";
  }

  if (process.env.GITHUB_TOKEN) {
    return "server-token";
  }

  if (process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET) {
    return "oauth-app";
  }

  return "anonymous";
}

function formatResetTime(resetAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(resetAt));
}

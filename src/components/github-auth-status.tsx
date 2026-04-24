import Link from "next/link";
import { Gauge, LogIn, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getGitHubAuthStateFromCookies } from "@/lib/auth-server";
import { cn } from "@/lib/utils";

type GitHubAuthStatusProps = {
  returnTo: string;
  compact?: boolean;
};

export async function GitHubAuthStatus({
  returnTo,
  compact = false,
}: GitHubAuthStatusProps) {
  const authState = await getGitHubAuthStateFromCookies();
  const loginHref = `/api/auth/github/login?next=${encodeURIComponent(returnTo)}`;
  const logoutHref = `/api/auth/logout?next=${encodeURIComponent(returnTo)}`;
  const content = getAuthCopy(authState.mode, authState.session?.login);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{content.badge}</Badge>
        {authState.session ? (
          <Badge variant="muted">@{authState.session.login}</Badge>
        ) : null}

        {authState.canLogin ? (
          <Link
            href={authState.session ? logoutHref : loginHref}
            className={cn(
              buttonVariants({
                variant: authState.session ? "outline" : "default",
                size: "sm",
              }),
            )}
          >
            {authState.session ? (
              <>
                <LogOut className="size-3.5" />
                退出
              </>
            ) : (
              <>
                <LogIn className="size-3.5" />
                登录
              </>
            )}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {authState.session ? (
            <ShieldCheck className="size-4" />
          ) : (
            <Gauge className="size-4" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold tracking-tight">
              {content.title}
            </h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {content.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{content.badge}</Badge>
            {authState.session ? (
              <Badge variant="muted">
                <UserCircle2 className="size-3" />
                @{authState.session.login}
              </Badge>
            ) : null}
          </div>
        </div>

        {authState.canLogin ? (
          <Link
            href={authState.session ? logoutHref : loginHref}
            className={cn(
              buttonVariants({
                variant: authState.session ? "outline" : "primary",
                size: "sm",
              }),
              "shrink-0",
            )}
          >
            {authState.session ? (
              <>
                <LogOut className="size-3.5" />
                退出 GitHub
              </>
            ) : (
              <>
                <LogIn className="size-3.5" />
                登录 GitHub
              </>
            )}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function getAuthCopy(mode: Awaited<ReturnType<typeof getGitHubAuthStateFromCookies>>["mode"], login?: string) {
  switch (mode) {
    case "user-token":
      return {
        title: "已登录 · 使用个人额度",
        badge: "用户独立额度",
        description: `当前请求会优先消耗 ${login ? `@${login}` : "当前账号"} 自己的 GitHub 配额，不占用站点公共额度。`,
      };
    case "oauth-app":
      return {
        title: "OAuth App 公共额度",
        badge: "应用公共额度",
        description:
          "未登录访客会走 GitHub OAuth App 的公共配额。登录后能进一步切到用户自己的额度。",
      };
    case "server-token":
      return {
        title: "服务器令牌模式",
        badge: "服务器共享额度",
        description:
          "服务器侧令牌模式适合开发与内部部署。面向公网的部署更推荐 OAuth App，把请求分摊到用户自己的额度。",
      };
    case "anonymous":
    default:
      return {
        title: "匿名模式",
        badge: "匿名共享额度",
        description:
          "匿名请求只有按 IP 共享的基础额度（~60/小时）。配置 GitHub OAuth App 或登录后会稳定很多。",
      };
  }
}

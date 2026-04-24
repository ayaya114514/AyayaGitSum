import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  MapPin,
  Sparkles,
  Star,
} from "lucide-react";

import { ActivityHeatmap } from "@/components/charts/activity-heatmap";
import { ContributionHeatmap } from "@/components/charts/contribution-heatmap";
import { LanguageDistributionChart } from "@/components/charts/language-distribution-chart";
import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { GitHubAuthStatus } from "@/components/github-auth-status";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SearchForm } from "@/components/search-form";
import { Badge } from "@/components/ui/badge";
import {
  buildDashboardAnalytics,
  formatRelativeDate,
} from "@/lib/analytics";
import { getAiProfileSummary } from "@/lib/ai-summary";
import { getGitHubAuthStateFromCookies } from "@/lib/auth-server";
import {
  getGitHubCommitActivitySample,
  getGitHubContributionData,
  getGitHubUserSnapshot,
  type RateLimitSnapshot,
} from "@/lib/github";
import { getBaseUrl } from "@/lib/site";
import { getStatusNotice, type StatusNotice } from "@/lib/status-notices";

type UserPageProps = {
  params: {
    username: string;
  };
};

export async function generateMetadata({
  params,
}: UserPageProps): Promise<Metadata> {
  const username = decodeURIComponent(params.username);

  try {
    const snapshot = await getGitHubUserSnapshot(username);
    const displayName = snapshot.user.name || snapshot.user.login;

    return {
      title: `${displayName} 的开发者画像`,
      description: `${displayName} 的 GitHub 仓库、语言分布、贡献热力图与 AI 总结。`,
      openGraph: {
        title: `${displayName} 的 GitPulse 画像`,
        description: `${displayName} 的 GitHub 仓库、语言分布、贡献热力图与 AI 总结。`,
        images: [`/api/og/${encodeURIComponent(username)}`],
      },
      twitter: {
        card: "summary_large_image",
        images: [`/api/og/${encodeURIComponent(username)}`],
      },
    };
  } catch {
    return {
      title: `${username} · GitPulse`,
    };
  }
}

export default async function UserPage({ params }: UserPageProps) {
  const username = decodeURIComponent(params.username);
  const authState = await getGitHubAuthStateFromCookies();
  const requestOptions = {
    userToken: authState.session?.accessToken,
  };

  let advancedNotice: StatusNotice | null = null;

  try {
    const snapshot = await getGitHubUserSnapshot(username, requestOptions);

    let contributionData = null;
    let contributionRateLimit: RateLimitSnapshot | null = null;
    let commitRateLimit: RateLimitSnapshot | null = null;

    try {
      contributionData = await getGitHubContributionData(username, requestOptions);
      contributionRateLimit = contributionData.rateLimit;
    } catch (error) {
      advancedNotice = getStatusNotice(error, { authMode: authState.mode });
    }

    let commitActivity = null;

    if (contributionData) {
      try {
        commitActivity = await getGitHubCommitActivitySample(
          username,
          contributionData.repositories,
          requestOptions,
        );
        commitRateLimit = commitActivity.rateLimit;
      } catch (error) {
        advancedNotice = getStatusNotice(error, { authMode: authState.mode });
      }
    }

    const analytics = buildDashboardAnalytics(
      snapshot.user,
      snapshot.repos,
      commitActivity?.samples ?? [],
    );

    const aiSummary = await getAiProfileSummary(
      username,
      snapshot.user,
      analytics,
      contributionData,
    );

    const primaryRateLimit = snapshot.rateLimit ?? contributionRateLimit ?? commitRateLimit;
    const displayName = snapshot.user.name || snapshot.user.login;

    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
          <div className="shell flex h-14 items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-foreground text-background text-[11px]">
                G
              </span>
              GitPulse
            </Link>

            <div className="hidden min-w-[280px] max-w-md flex-1 sm:block">
              <SearchForm initialValue={snapshot.user.login} compact />
            </div>

            <div className="flex items-center gap-2">
              <GitHubAuthStatus
                returnTo={`/user/${encodeURIComponent(snapshot.user.login)}`}
                compact
              />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="shell space-y-6 py-8">
          {/* Profile header */}
          <section className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-muted">
                <Image
                  src={snapshot.user.avatarUrl}
                  alt={snapshot.user.login}
                  fill
                  className="object-cover"
                  sizes="80px"
                  priority
                />
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      {displayName}
                    </h1>
                    <Badge variant="muted">@{snapshot.user.login}</Badge>
                    <Link
                      href={snapshot.user.profileUrl}
                      target="_blank"
                      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      GitHub
                      <ArrowUpRight className="size-3" />
                    </Link>
                  </div>

                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {snapshot.user.bio || "这个用户还没有填写个人简介。"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {snapshot.user.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {snapshot.user.location}
                    </span>
                  ) : null}
                  {snapshot.user.company ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3.5" />
                      {snapshot.user.company}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    最近更新 {analytics.lastUpdatedLabel}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <CopyMarkdownButton
                  appUrl={getBaseUrl()}
                  username={snapshot.user.login}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile label="Followers" value={snapshot.user.followers} />
              <MetricTile label="公开仓库" value={snapshot.user.publicRepos} />
              <MetricTile label="总 Star" value={analytics.totalStars} />
              <MetricTile
                label="90 天活跃仓库"
                value={analytics.activeReposLast90Days}
              />
            </div>
          </section>

          {/* AI summary + habits */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                画像摘要
              </div>
              <p className="mt-3 text-[15px] leading-7 text-foreground/90">
                {aiSummary.summary ||
                  "配置 GEMINI_API_KEY 后，这里会根据语言分布、活跃时段和仓库类型生成 2–3 句 AI 画像总结。"}
              </p>

              {analytics.habitTags.length ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {analytics.habitTags.map((tag) => (
                    <div
                      key={tag.label}
                      className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-2.5"
                    >
                      <p className="text-sm font-medium">{tag.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {tag.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                仓库类型
              </div>
              <div className="mt-3 space-y-2">
                {analytics.repoCategories.map((category) => {
                  const total = analytics.repoCategories.reduce(
                    (sum, item) => sum + item.value,
                    0,
                  );
                  const ratio = total > 0 ? category.value / total : 0;
                  return (
                    <div key={category.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{category.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {category.value}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(6, ratio * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {contributionData ? (
                <div className="mt-5 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">年度贡献总量</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                    {contributionData.totalContributions.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    覆盖年份 {contributionData.contributionYears.join(" · ")}
                  </p>
                </div>
              ) : null}

              {primaryRateLimit ? (
                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                  当前模式{" "}
                  <span className="text-foreground">
                    {authModeLabel(authState.mode)}
                  </span>
                  ，GitHub {primaryRateLimit.source.toUpperCase()} 剩余{" "}
                  <span className="tabular-nums text-foreground">
                    {primaryRateLimit.remaining ?? "--"}
                  </span>
                  {primaryRateLimit.limit ? ` / ${primaryRateLimit.limit}` : ""}
                </p>
              ) : null}
            </div>
          </section>

          {advancedNotice ? (
            <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{advancedNotice.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {advancedNotice.description}
                </p>
              </div>
            </div>
          ) : null}

          {/* Language + contribution heatmap */}
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <PanelCard title="语言分布">
              <LanguageDistributionChart
                data={analytics.languageBreakdown.map((item) => ({
                  name: item.name,
                  value: item.value,
                  color: item.color,
                }))}
              />
            </PanelCard>

            <PanelCard title="贡献热力图">
              {contributionData ? (
                <ContributionHeatmap weeks={contributionData.weeks} />
              ) : (
                <EmptyState text="配置 GitHub OAuth App、服务器令牌，或直接登录后，这里会显示过去一年的贡献日历。" />
              )}
            </PanelCard>
          </section>

          {/* Activity matrix */}
          <PanelCard title="活跃时段矩阵">
            {analytics.activityHighlight ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricTile
                    label="高峰时间"
                    value={analytics.activityHighlight.peakHourLabel}
                  />
                  <MetricTile
                    label="最忙星期"
                    value={analytics.activityHighlight.busiestDayLabel}
                  />
                  <MetricTile
                    label="采样 commit"
                    value={analytics.activityHighlight.commitSampleCount}
                  />
                </div>
                <ActivityHeatmap matrix={analytics.activityMatrix} />
                <p className="text-xs text-muted-foreground">
                  时区：{analytics.timezone}
                </p>
              </div>
            ) : (
              <EmptyState text="当前没有足够的 commit 时间样本来绘制小时级矩阵。" />
            )}
          </PanelCard>

          {/* Top repos */}
          <PanelCard title={`Top 仓库 · ${analytics.topRepositories.length}`}>
            <div className="divide-y divide-border/70">
              {analytics.topRepositories.map((repo, index) => (
                <div
                  key={repo.id}
                  className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Link
                        href={repo.url}
                        target="_blank"
                        className="truncate text-sm font-medium hover:text-primary transition-colors"
                      >
                        {repo.name}
                      </Link>
                      {repo.fork ? (
                        <Badge variant="muted">fork</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                      {repo.description || "这个仓库还没有填写描述。"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Star className="size-3.5 text-muted-foreground" />
                      {repo.stargazersCount.toLocaleString()}
                    </span>
                    {repo.language ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-muted-foreground/60" />
                        {repo.language}
                      </span>
                    ) : null}
                    <span>{formatRelativeDate(repo.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>
        </main>
      </div>
    );
  } catch (error) {
    const notice = getStatusNotice(error, { authMode: authState.mode });

    return (
      <div className="min-h-screen">
        <header className="shell flex h-14 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-foreground text-background text-[11px]">
              G
            </span>
            GitPulse
          </Link>
          <ThemeToggle />
        </header>

        <main className="shell py-16">
          <div className="mx-auto max-w-xl space-y-6 text-center">
            <div className="mx-auto inline-flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {notice.title}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {notice.description}
              </p>
            </div>
            <div className="mx-auto max-w-sm">
              <SearchForm initialValue={username} />
            </div>
          </div>
        </main>
      </div>
    );
  }
}

function authModeLabel(mode: Awaited<ReturnType<typeof getGitHubAuthStateFromCookies>>["mode"]) {
  switch (mode) {
    case "user-token":
      return "登录用户";
    case "oauth-app":
      return "OAuth App";
    case "server-token":
      return "服务器令牌";
    case "anonymous":
    default:
      return "匿名";
  }
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 px-3.5 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">
        {displayValue}
      </p>
    </div>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/70 px-5 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

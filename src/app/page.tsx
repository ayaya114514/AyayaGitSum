import Link from "next/link";
import { ArrowUpRight, Flame, FolderGit2, Sparkles } from "lucide-react";

import { GitHubAuthStatus } from "@/components/github-auth-status";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SearchForm } from "@/components/search-form";

const highlights = [
  {
    title: "REST + GraphQL 数据层",
    description: "资料、仓库、贡献日历与活跃时段走统一缓存，触发限流会回落到友好提示。",
    icon: FolderGit2,
  },
  {
    title: "图表化开发者画像",
    description: "语言环形图、Top 仓库、年度热力图、活跃时段矩阵一次看完节奏。",
    icon: Flame,
  },
  {
    title: "AI 总结 + 分享卡片",
    description: "Anthropic 画像总结 + 动态 OG 图片，直接粘贴到 README 和 issue 里。",
    icon: Sparkles,
  },
];

const sampleUsers = ["gaearon", "tj", "sindresorhus", "yyx990803"];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="shell flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-foreground text-background text-[11px]">
            G
          </span>
          GitPulse
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com"
            target="_blank"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            GitHub
            <ArrowUpRight className="size-3" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="shell space-y-16 pt-6 pb-20">
        <section className="hero-spotlight relative overflow-hidden rounded-3xl border border-border/70 bg-card/50">
          <div className="grid-bg absolute inset-0 opacity-60" />
          <div className="relative px-6 py-14 sm:px-12 sm:py-20 lg:py-24">
            <div className="mx-auto max-w-3xl space-y-6 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Next.js 14 · Tailwind · shadcn/ui
              </div>

              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                把一个 GitHub 用户名
                <br className="hidden sm:block" />
                变成一页开发者名片
              </h1>

              <p className="mx-auto max-w-xl text-[15px] leading-7 text-muted-foreground">
                资料卡片、语言分布、贡献热力图、活跃时段矩阵、Top 仓库、AI 画像总结，
                以及一张可嵌入 README 的分享卡片。
              </p>

              <div className="mx-auto max-w-xl pt-2">
                <SearchForm />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-2 text-xs text-muted-foreground">
                <span>试试</span>
                {sampleUsers.map((name) => (
                  <Link
                    key={name}
                    href={`/user/${name}`}
                    className="rounded-md border border-border/70 bg-card px-2 py-0.5 hover:border-foreground/30 hover:text-foreground transition-colors"
                  >
                    @{name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-foreground/20"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="size-4" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                鉴权与配额
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                GitHub API 会按当前鉴权模式分配不同额度。
              </p>
            </div>
          </div>
          <GitHubAuthStatus returnTo="/" />
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="shell flex h-12 items-center justify-between text-xs text-muted-foreground">
          <span>GitPulse · 开发者画像</span>
          <span>数据来自 GitHub 公开 API</span>
        </div>
      </footer>
    </div>
  );
}

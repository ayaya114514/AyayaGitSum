export const siteConfig = {
  name: "GitPulse",
  description:
    "把 GitHub 用户画像、代码语言、贡献节奏和 AI 总结打包成一张可分享的开发者名片。",
  defaultUrl:
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://gitpulse.vercel.app",
  githubApiVersion: "2022-11-28",
} as const;

export const fallbackLanguageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#a97bff",
  Swift: "#f05138",
  PHP: "#4f5d95",
  Ruby: "#701516",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Shell: "#89e051",
  Dart: "#00b4ab",
  Elixir: "#6e4a7e",
  Lua: "#000080",
  Scala: "#c22d40",
  Jupyter: "#da5b0b",
  Unknown: "#94a3b8",
};

export function getBaseUrl() {
  return siteConfig.defaultUrl;
}

export function getLanguageColor(language: string | null | undefined) {
  if (!language) {
    return fallbackLanguageColors.Unknown;
  }

  return fallbackLanguageColors[language] ?? fallbackLanguageColors.Unknown;
}

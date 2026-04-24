import { createHash } from "node:crypto";

import { unstable_cache } from "next/cache";

import type { DashboardAnalytics } from "@/lib/analytics";
import { buildAiInputSummary } from "@/lib/analytics";
import type { GitHubContributionData, GitHubUser } from "@/lib/github";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT =
  "你是 GitHub 开发者画像分析助手。基于结构化统计生成 2-3 句中文总结，风格要有洞察但不夸张，避免编造未给出的事实。直接输出总结文本，不要加前缀、标题或多余解释。";

export type AiProfileSummary = {
  available: boolean;
  summary: string | null;
  reason?: "missing-token" | "api-error";
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

async function generateAiProfileSummaryInternal(
  user: GitHubUser,
  analytics: DashboardAnalytics,
  contributions: GitHubContributionData | null,
): Promise<AiProfileSummary> {
  if (!GEMINI_API_KEY) {
    return {
      available: false,
      summary: null,
      reason: "missing-token",
    };
  }

  const summaryInput = buildAiInputSummary(user, analytics, contributions);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `请基于以下 JSON 统计给出 GitHub 用户画像总结：\n${JSON.stringify(
                  summaryInput,
                  null,
                  2,
                )}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 260,
          topP: 0.95,
        },
      }),
    });

    if (!response.ok) {
      return { available: false, summary: null, reason: "api-error" };
    }

    const payload = (await response.json()) as GeminiResponse;

    if (payload.error) {
      return { available: false, summary: null, reason: "api-error" };
    }

    const summary = (payload.candidates ?? [])
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim();

    return {
      available: true,
      summary: summary || null,
    };
  } catch {
    return {
      available: false,
      summary: null,
      reason: "api-error",
    };
  }
}

export function getAiProfileSummary(
  username: string,
  user: GitHubUser,
  analytics: DashboardAnalytics,
  contributions: GitHubContributionData | null,
) {
  const normalizedUsername = username.trim().toLowerCase();
  const hash = createHash("sha1")
    .update(JSON.stringify(buildAiInputSummary(user, analytics, contributions)))
    .digest("hex");

  return unstable_cache(
    () => generateAiProfileSummaryInternal(user, analytics, contributions),
    [`gitpulse-ai-profile:${normalizedUsername}:${hash}`],
    {
      revalidate: 60 * 60 * 6,
      tags: [`gitpulse-ai:${normalizedUsername}`],
    },
  )();
}

"use client";

import { useState } from "react";
import { useTheme } from "next-themes";

import { heatmapThemes, type HeatmapThemeKey, getHeatmapColor } from "@/lib/heatmap";

type ContributionHeatmapProps = {
  weeks: {
    firstDay: string;
    contributionDays: {
      contributionCount: number;
      date: string;
      weekday: number;
    }[];
  }[];
};

export function ContributionHeatmap({ weeks }: ContributionHeatmapProps) {
  const { resolvedTheme } = useTheme();
  const [themeKey, setThemeKey] = useState<HeatmapThemeKey>("emerald");

  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const maxCount = Math.max(
    0,
    ...weeks.flatMap((week) =>
      week.contributionDays.map((day) => day.contributionCount),
    ),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {Object.entries(heatmapThemes).map(([key, theme]) => (
          <button
            key={key}
            type="button"
            onClick={() => setThemeKey(key as HeatmapThemeKey)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
              themeKey === key
                ? "border-foreground/40 bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {theme.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/40 p-3">
        <svg
          width={Math.max(weeks.length * 15 + 52, 720)}
          height={164}
          role="img"
          aria-label="年度贡献热力图"
          className="min-w-full"
        >
          {weeks.map((week, weekIndex) =>
            week.contributionDays.map((day) => {
              const x = 40 + weekIndex * 15;
              const y = 28 + day.weekday * 17;

              return (
                <g key={`${day.date}-${weekIndex}`}>
                  <rect
                    x={x}
                    y={y}
                    width={12}
                    height={12}
                    rx={4}
                    fill={getHeatmapColor(
                      day.contributionCount,
                      maxCount,
                      themeKey,
                      mode,
                    )}
                  >
                    <title>
                      {day.date} · {day.contributionCount} 次贡献
                    </title>
                  </rect>
                </g>
              );
            }),
          )}

          {weeks.map((week, weekIndex) => {
            const month = new Date(`${week.firstDay}T00:00:00Z`).getUTCMonth();
            const previousMonth =
              weekIndex > 0
                ? new Date(`${weeks[weekIndex - 1].firstDay}T00:00:00Z`).getUTCMonth()
                : -1;

            if (weekIndex > 0 && month === previousMonth) {
              return null;
            }

            return (
              <text
                key={week.firstDay}
                x={40 + weekIndex * 15}
                y={14}
                className="fill-muted-foreground text-[10px]"
              >
                {new Intl.DateTimeFormat("zh-CN", { month: "short" }).format(
                  new Date(`${week.firstDay}T00:00:00Z`),
                )}
              </text>
            );
          })}

          {["日", "一", "二", "三", "四", "五", "六"].map((label, index) => (
            <text
              key={label}
              x={0}
              y={38 + index * 17}
              className="fill-muted-foreground text-[10px]"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

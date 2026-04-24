"use client";

import { useTheme } from "next-themes";

import { getHeatmapColor } from "@/lib/heatmap";

type ActivityHeatmapProps = {
  matrix: number[][];
};

const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function ActivityHeatmap({ matrix }: ActivityHeatmapProps) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const maxCount = Math.max(0, ...matrix.flat());

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/40 p-3">
      <svg width={760} height={250} role="img" aria-label="提交活跃时段矩阵">
        {Array.from({ length: 24 }).map((_, hour) => (
          <text
            key={hour}
            x={78 + hour * 26}
            y={22}
            className="fill-muted-foreground text-[10px]"
          >
            {String(hour).padStart(2, "0")}
          </text>
        ))}

        {weekdayLabels.map((label, day) => (
          <text
            key={label}
            x={0}
            y={52 + day * 26}
            className="fill-muted-foreground text-[11px]"
          >
            {label}
          </text>
        ))}

        {matrix.map((dayRow, dayIndex) =>
          dayRow.map((count, hour) => (
            <rect
              key={`${dayIndex}-${hour}`}
              x={70 + hour * 26}
              y={36 + dayIndex * 26}
              width={18}
              height={18}
              rx={6}
              fill={getHeatmapColor(count, maxCount, "ocean", mode)}
            >
              <title>
                {weekdayLabels[dayIndex]} {String(hour).padStart(2, "0")}:00 · {count} 次提交
              </title>
            </rect>
          )),
        )}
      </svg>
    </div>
  );
}

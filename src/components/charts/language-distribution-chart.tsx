"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type LanguageDistributionChartProps = {
  data: {
    name: string;
    value: number;
    color: string;
  }[];
};

export function LanguageDistributionChart({
  data,
}: LanguageDistributionChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div className="relative h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={82}
              strokeWidth={2}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value} 个仓库`, name]}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 12,
                boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
              }}
              cursor={{ fill: "transparent" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            仓库
          </span>
          <span className="text-xl font-semibold tabular-nums">{total}</span>
        </div>
      </div>

      <div className="grid content-start gap-1.5">
        {data.map((language) => {
          const ratio = total > 0 ? (language.value / total) * 100 : 0;
          return (
            <div
              key={language.name}
              className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-sm hover:bg-muted/60 transition-colors"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: language.color }}
                />
                <span className="truncate text-sm">{language.name}</span>
              </div>
              <div className="flex items-baseline gap-2 text-xs text-muted-foreground tabular-nums">
                <span>{ratio.toFixed(0)}%</span>
                <span className="w-6 text-right text-foreground">
                  {language.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

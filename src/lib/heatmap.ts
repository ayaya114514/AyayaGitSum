export const heatmapThemes = {
  emerald: {
    label: "Emerald Flow",
    light: ["#bbf7d0", "#86efac", "#22c55e", "#15803d"],
    dark: ["#14532d", "#166534", "#22c55e", "#86efac"],
    empty: {
      light: "#e7f2ec",
      dark: "#17212b",
    },
  },
  ocean: {
    label: "Ocean Signal",
    light: ["#bae6fd", "#7dd3fc", "#0ea5e9", "#0369a1"],
    dark: ["#082f49", "#0c4a6e", "#0284c7", "#38bdf8"],
    empty: {
      light: "#e5eef5",
      dark: "#111c26",
    },
  },
  ember: {
    label: "Ember Pulse",
    light: ["#fed7aa", "#fdba74", "#f97316", "#c2410c"],
    dark: ["#431407", "#7c2d12", "#ea580c", "#fb923c"],
    empty: {
      light: "#f6ece4",
      dark: "#231a16",
    },
  },
} as const;

export type HeatmapThemeKey = keyof typeof heatmapThemes;

export function getHeatmapColor(
  count: number,
  maxCount: number,
  themeKey: HeatmapThemeKey,
  mode: "light" | "dark",
) {
  const theme = heatmapThemes[themeKey];

  if (count <= 0 || maxCount <= 0) {
    return theme.empty[mode];
  }

  const ratio = count / maxCount;

  if (ratio <= 0.25) {
    return theme[mode][0];
  }

  if (ratio <= 0.5) {
    return theme[mode][1];
  }

  if (ratio <= 0.75) {
    return theme[mode][2];
  }

  return theme[mode][3];
}

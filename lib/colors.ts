export const LIGHT_COLORS = [
  "#D4B8F0",
  "#FFCAB0",
  "#C4EDBA",
  "#C5E8EC",
  "#F9E9A8",
];

export const DARK_COLORS = [
  "#9B7BC7",
  "#E8936A",
  "#7BC96A",
  "#7ABCC5",
  "#D4C468",
];

export const COLOR_MAP: Record<string, string> = {
  "#D4B8F0": "#9B7BC7",
  "#FFCAB0": "#E8936A",
  "#C4EDBA": "#7BC96A",
  "#C5E8EC": "#7ABCC5",
  "#F9E9A8": "#D4C468",
  "#9B7BC7": "#D4B8F0",
  "#E8936A": "#FFCAB0",
  "#7BC96A": "#C4EDBA",
  "#7ABCC5": "#C5E8EC",
  "#D4C468": "#F9E9A8",
};

/**
 * Gets the display color for a stored color based on the current theme.
 * Maps between light and dark color variants automatically.
 */
export function getDisplayColor(
  storedColor: string,
  isDark: boolean,
  mounted: boolean,
): string {
  if (!mounted) return storedColor;
  const isStoredDark = DARK_COLORS.includes(storedColor);
  if (isDark && !isStoredDark) {
    return COLOR_MAP[storedColor] || storedColor;
  }
  if (!isDark && isStoredDark) {
    return COLOR_MAP[storedColor] || storedColor;
  }
  return storedColor;
}

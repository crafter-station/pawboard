"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

// Thread color palette - hardcoded for Safari compatibility
const THREAD_COLORS = {
  light: {
    surface: "#F7F6F3",
    surfaceHover: "#EFEDE8",
    border: "#E2DFD8",
    divider: "#E7E5E0",
    textPrimary: "#1C1917",
    textSecondary: "#78716C",
    avatarRing: "#3B82F6",
    avatarRingFaded: "rgba(59, 130, 246, 0.3)",
    avatarRingMedium: "rgba(59, 130, 246, 0.5)",
    shadow:
      "0 4px 12px rgba(28, 25, 23, 0.08), 0 2px 4px rgba(28, 25, 23, 0.04)",
    shadowElevated:
      "0 8px 24px rgba(28, 25, 23, 0.12), 0 4px 8px rgba(28, 25, 23, 0.06)",
  },
  dark: {
    surface: "#2C2C2C",
    surfaceHover: "#363636",
    border: "#404040",
    divider: "#404040",
    textPrimary: "#FFFFFF",
    textSecondary: "#9CA3AF",
    avatarRing: "#60A5FA",
    avatarRingFaded: "rgba(96, 165, 250, 0.3)",
    avatarRingMedium: "rgba(96, 165, 250, 0.5)",
    shadow: "0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
    shadowElevated:
      "0 8px 24px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)",
  },
} as const;

export interface ThreadColors {
  surface: string;
  surfaceHover: string;
  border: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  avatarRing: string;
  avatarRingFaded: string;
  avatarRingMedium: string;
  shadow: string;
  shadowElevated: string;
}

export function useThreadColors(): ThreadColors {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return light theme colors during SSR and before mount to avoid hydration mismatch
  if (!mounted) {
    return THREAD_COLORS.light;
  }

  return resolvedTheme === "dark" ? THREAD_COLORS.dark : THREAD_COLORS.light;
}

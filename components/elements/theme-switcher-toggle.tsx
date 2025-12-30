"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";
import { useCatSound } from "@/hooks/use-cat-sound";

interface ThemeSwitcherToggleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function ThemeSwitcherToggle({
  className,
  ...props
}: ThemeSwitcherToggleProps) {
  const { theme, setTheme } = useTheme();
  const { startTransition, endTransition } = useThemeStore();
  const playSound = useCatSound();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      playSound();
      const x = event.clientX;
      const y = event.clientY;
      const newTheme = theme === "light" ? "dark" : "light";

      if (
        !document.startViewTransition ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        setTheme(newTheme);
        return;
      }

      startTransition(x, y);

      const transition = document.startViewTransition(() => {
        setTheme(newTheme);
      });

      try {
        await transition.ready;

        const maxRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );

        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 500,
            easing: "ease-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );

        await transition.finished;
      } finally {
        endTransition();
      }
    },
    [theme, setTheme, startTransition, endTransition, playSound],
  );

  if (!mounted) {
    return (
      <div className={cn("flex items-center space-x-2", className)} {...props}>
        <div className="w-10 h-6 bg-input rounded-full animate-pulse" />
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <div className={cn("flex items-center space-x-2", className)} {...props}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
          isDark ? "bg-foreground/20" : "bg-muted"
        }`}
      >
        <span className="sr-only">Toggle theme</span>
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background transition duration-200 ease-in-out ${
            isDark ? "translate-x-6" : "translate-x-1"
          }`}
        >
          {isDark ? (
            <MoonIcon className="h-3 w-3 text-foreground mt-0.5 ml-0.5" />
          ) : (
            <SunIcon className="h-3 w-3 text-foreground mt-0.5 ml-0.5" />
          )}
        </span>
      </button>
    </div>
  );
}

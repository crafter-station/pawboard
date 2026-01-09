"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/db/schema";
import { useMinimap } from "@/hooks/use-minimap";
import { getDisplayColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

interface MinimapProps {
  cards: Card[];
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  onNavigate: (worldPoint: { x: number; y: number }) => void;
  onZoom?: (worldPoint: { x: number; y: number }, delta: number) => void;
  className?: string;
}

export function Minimap({
  cards,
  pan,
  zoom,
  viewportWidth,
  viewportHeight,
  onNavigate,
  onZoom,
  className,
}: MinimapProps) {
  const { resolvedTheme } = useTheme();
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const {
    isMobile,
    minimapSize,
    cardSize,
    minimapViewport,
    worldToMinimap,
    getWorldFromPointerEvent,
  } = useMinimap({
    cards,
    pan,
    zoom,
    viewportWidth,
    viewportHeight,
  });

  const colors = useMemo(
    () => ({
      background: isDark ? "hsl(222, 47%, 11%)" : "hsl(0, 0%, 98%)",
      pattern: isDark ? "hsl(215, 28%, 17%)" : "hsl(0, 0%, 50%)",
      patternOpacity: isDark ? 0.35 : 0.08,
      viewportFill: isDark ? "hsl(210, 100%, 60%)" : "hsl(var(--primary))",
      viewportFillOpacity: isDark ? 0.18 : 0.3,
      viewportStroke: isDark ? "hsl(0, 0%, 98%)" : "hsl(var(--foreground))",
    }),
    [isDark],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      svgRef.current?.setPointerCapture(e.pointerId);
      setDragging(true);
      const rect = svgRef.current!.getBoundingClientRect();
      const worldPoint = getWorldFromPointerEvent(e, rect);
      onNavigate(worldPoint);
    },
    [getWorldFromPointerEvent, onNavigate],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const rect = svgRef.current!.getBoundingClientRect();
      const worldPoint = getWorldFromPointerEvent(e, rect);
      onNavigate(worldPoint);
    },
    [dragging, getWorldFromPointerEvent, onNavigate],
  );

  const handlePointerUp = useCallback(() => setDragging(false), []);

  // Wheel event handler (non-passive to allow preventDefault)
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement || !onZoom) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svgElement.getBoundingClientRect();
      const worldPoint = getWorldFromPointerEvent(e, rect);
      onZoom(worldPoint, e.deltaY);
    };

    // Add non-passive listener to allow preventDefault
    svgElement.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      svgElement.removeEventListener("wheel", handleWheel);
    };
  }, [onZoom, getWorldFromPointerEvent]);

  if (!cards.length) return null;

  return (
    <div className={cn("relative", className)}>
      <svg
        ref={svgRef}
        width={minimapSize}
        height={minimapSize}
        viewBox={`0 0 ${minimapSize} ${minimapSize}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="rounded-xl border bg-card/95 backdrop-blur-md shadow-lg"
      >
        {/* Background */}
        <defs>
          <pattern id="dots" width="12" height="12">
            <circle
              cx="6"
              cy="6"
              r="0.8"
              fill={colors.pattern}
              opacity={colors.patternOpacity}
            />
          </pattern>
        </defs>

        <rect
          width={minimapSize}
          height={minimapSize}
          fill={colors.background}
        />
        <rect
          width={minimapSize}
          height={minimapSize}
          fill="url(#dots)"
          opacity={isDark ? 0.7 : 0.4}
        />

        {/* Cards */}
        {cards.map((c) => {
          const tl = worldToMinimap(c.x, c.y);
          const br = worldToMinimap(c.x + cardSize.w, c.y + cardSize.h);

          const w = Math.max(1, br.x - tl.x);
          const h = Math.max(1, br.y - tl.y);
          const displayColor = getDisplayColor(c.color, isDark, mounted);

          return (
            <rect
              key={c.id}
              x={tl.x}
              y={tl.y}
              width={w}
              height={h}
              rx="1"
              fill={displayColor}
              stroke="hsl(var(--background))"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Viewport */}
        <rect
          x={minimapViewport.x}
          y={minimapViewport.y}
          width={minimapViewport.w}
          height={minimapViewport.h}
          rx="4"
          fill={colors.viewportFill}
          fillOpacity={colors.viewportFillOpacity}
          stroke={colors.viewportStroke}
          strokeWidth={isMobile ? 2.5 : 3}
        />
      </svg>
    </div>
  );
}

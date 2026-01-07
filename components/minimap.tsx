"use client";

import { Card } from "@/db/schema";
import { useMinimap } from "@/hooks/use-minimap";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useCallback, useMemo, useRef, useState } from "react";

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
  const { theme } = useTheme();
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

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
      background: theme === "dark" ? "hsl(224, 71%, 4%)" : "hsl(0, 0%, 98%)",
      pattern: theme === "dark" ? "hsl(215, 25%, 27%)" : "hsl(0, 0%, 50%)",
      patternOpacity: theme === "dark" ? 0.25 : 0.08,
    }),
    [theme]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      svgRef.current?.setPointerCapture(e.pointerId);
      setDragging(true);
      const rect = svgRef.current!.getBoundingClientRect();
      const worldPoint = getWorldFromPointerEvent(e, rect);
      onNavigate(worldPoint);
    },
    [getWorldFromPointerEvent, onNavigate]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const rect = svgRef.current!.getBoundingClientRect();
      const worldPoint = getWorldFromPointerEvent(e, rect);
      onNavigate(worldPoint);
    },
    [dragging, getWorldFromPointerEvent, onNavigate]
  );

  const handlePointerUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!onZoom) return;
      e.preventDefault();
      const rect = svgRef.current!.getBoundingClientRect();
      const worldPoint = getWorldFromPointerEvent(e, rect);
      onZoom(worldPoint, e.deltaY);
    },
    [onZoom, getWorldFromPointerEvent]
  );

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
        onWheel={handleWheel}
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
          opacity={theme === "dark" ? 0.7 : 0.4}
        />

        {/* Cards */}
        {cards.map((c) => {
          const tl = worldToMinimap(c.x, c.y);
          const br = worldToMinimap(c.x + cardSize.w, c.y + cardSize.h);

          const h = Math.max(1, br.y - tl.y);
          const w = Math.min(br.x - tl.x, h * 0.9);

          return (
            <rect
              key={c.id}
              x={tl.x}
              y={tl.y}
              width={w}
              height={h}
              rx="1"
              fill={c.color}
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
          fill="hsl(var(--primary))"
          fillOpacity="0.3"
          stroke="hsl(var(--foreground))"
          strokeWidth={isMobile ? 2.5 : 3}
        />
      </svg>
    </div>
  );
}

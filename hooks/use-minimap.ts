import { Card } from "@/db/schema";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";

const CARD_SIZE = {
  desktop: { w: 224, h: 160 },
  mobile: { w: 160, h: 120 },
};

const MINIMAP_SIZE = {
  desktop: 178,
  mobile: 165,
};

const PADDING = 8;
const WORLD_PADDING = 200;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

interface UseMinimapOptions {
  cards: Card[];
  pan: { x: number; y: number };
  zoom: number;
  viewportWidth: number;
  viewportHeight: number;
  snapToCenter?: boolean;
}

export function useMinimap({
  cards,
  pan,
  zoom,
  viewportWidth,
  viewportHeight,
}: UseMinimapOptions) {
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cardSize = isMobile ? CARD_SIZE.mobile : CARD_SIZE.desktop;
  const minimapSize = isMobile ? MINIMAP_SIZE.mobile : MINIMAP_SIZE.desktop;

  const worldBounds = useMemo(() => {
    if (!cards.length) {
      return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const c of cards) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + cardSize.w);
      maxY = Math.max(maxY, c.y + cardSize.h);
    }

    return {
      minX: minX - WORLD_PADDING,
      minY: minY - WORLD_PADDING,
      maxX: maxX + WORLD_PADDING,
      maxY: maxY + WORLD_PADDING,
    };
  }, [cards, cardSize]);

  const worldSize = {
    w: worldBounds.maxX - worldBounds.minX,
    h: worldBounds.maxY - worldBounds.minY,
  };

  const scale = useMemo(() => {
    const usable = minimapSize - PADDING * 2;
    return Math.min(usable / worldSize.w, usable / worldSize.h);
  }, [worldSize, minimapSize]);

  const worldToMinimap = useCallback(
    (x: number, y: number) => ({
      x: PADDING + (x - worldBounds.minX) * scale,
      y: PADDING + (y - worldBounds.minY) * scale,
    }),
    [worldBounds, scale]
  );

  const minimapToWorld = useCallback(
    (x: number, y: number) => ({
      x: worldBounds.minX + (x - PADDING) / scale,
      y: worldBounds.minY + (y - PADDING) / scale,
    }),
    [worldBounds, scale]
  );

  const viewportWorld = useMemo(() => {
    const x = -pan.x / zoom;
    const y = -pan.y / zoom;

    return {
      x,
      y,
      w: viewportWidth / zoom,
      h: viewportHeight / zoom,
    };
  }, [pan, zoom, viewportWidth, viewportHeight]);

  const minimapViewport = useMemo(() => {
    const tl = worldToMinimap(viewportWorld.x, viewportWorld.y);
    const br = worldToMinimap(
      viewportWorld.x + viewportWorld.w,
      viewportWorld.y + viewportWorld.h
    );

    return {
      x: tl.x,
      y: tl.y,
      w: br.x - tl.x,
      h: br.y - tl.y,
    };
  }, [viewportWorld, worldToMinimap]);

  const getWorldFromPointerEvent = useCallback(
    (e: { clientX: number; clientY: number }, svgRect: DOMRect) => {
      const x = clamp(e.clientX - svgRect.left, PADDING, minimapSize - PADDING);
      const y = clamp(e.clientY - svgRect.top, PADDING, minimapSize - PADDING);

      return minimapToWorld(x, y);
    },
    [minimapSize, minimapToWorld]
  );

  return {
    isMobile,
    minimapSize,
    cardSize,
    worldBounds,
    minimapViewport,
    worldToMinimap,
    minimapToWorld,
    getWorldFromPointerEvent,
  };
}

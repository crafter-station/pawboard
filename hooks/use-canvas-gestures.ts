import { useCallback, useEffect, useRef, useState } from "react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

interface Point {
  x: number;
  y: number;
}

interface UseCanvasGesturesOptions {
  initialPan?: Point;
  initialZoom?: number;
}

export function useCanvasGestures(options: UseCanvasGesturesOptions = {}) {
  const { initialPan = { x: 0, y: 0 }, initialZoom = 1 } = options;

  const [pan, setPan] = useState<Point>(initialPan);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(
    null,
  );

  // Use callback ref to trigger effect when canvas mounts
  const canvasRef = useCallback((node: HTMLDivElement | null) => {
    setCanvasElement(node);
  }, []);

  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panStartPanRef = useRef<Point>({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<Point | null>(null);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screen: Point): Point => ({
      x: (screen.x - pan.x) / zoom,
      y: (screen.y - pan.y) / zoom,
    }),
    [pan, zoom],
  );

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (world: Point): Point => ({
      x: world.x * zoom + pan.x,
      y: world.y * zoom + pan.y,
    }),
    [pan, zoom],
  );

  // Zoom toward a specific point (keeps that point fixed on screen)
  const zoomTo = useCallback(
    (newZoom: number, origin?: Point) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      const zoomOrigin = origin || {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };

      const zoomRatio = clampedZoom / zoom;
      const newPan = {
        x: zoomOrigin.x - (zoomOrigin.x - pan.x) * zoomRatio,
        y: zoomOrigin.y - (zoomOrigin.y - pan.y) * zoomRatio,
      };

      setZoom(clampedZoom);
      setPan(newPan);
    },
    [zoom, pan],
  );

  // Reset view to default
  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // Fit view to show all provided bounds
  const fitToBounds = useCallback(
    (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const padding = 100;
      const contentWidth = bounds.maxX - bounds.minX + padding * 2;
      const contentHeight = bounds.maxY - bounds.minY + padding * 2;

      const scaleX = window.innerWidth / contentWidth;
      const scaleY = window.innerHeight / contentHeight;
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)),
      );

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      setPan({
        x: window.innerWidth / 2 - centerX * newZoom,
        y: window.innerHeight / 2 - centerY * newZoom,
      });
      setZoom(newZoom);
    },
    [],
  );

  // Center view on a point
  const centerOn = useCallback(
    (point: Point, newZoom?: number) => {
      const z = newZoom ?? zoom;
      setPan({
        x: window.innerWidth / 2 - point.x * z,
        y: window.innerHeight / 2 - point.y * z,
      });
      if (newZoom !== undefined) {
        setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
      }
    },
    [zoom],
  );

  // Handle middle mouse button pan or space+left-click pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse button (button === 1) or Space + left-click (button === 0)
      if (e.button === 1 || (isSpacePressed && e.button === 0)) {
        e.preventDefault();
        e.stopPropagation();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panStartPanRef.current = { ...pan };
      }
    },
    [pan, isSpacePressed],
  );

  // Handle wheel for zoom (Ctrl/Cmd + scroll), horizontal pan (Shift + scroll) or pan (regular scroll)
  // Using native event listener with { passive: false } to properly prevent browser zoom
  useEffect(() => {
    if (!canvasElement) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent default to block native browser zoom/scroll
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+scroll = canvas zoom
        // Higher multiplier = more sensitive zoom
        const delta = -e.deltaY * 0.003;
        const newZoom = zoom * (1 + delta);
        zoomTo(newZoom, { x: e.clientX, y: e.clientY });
      } else if (e.shiftKey) {
        // Shift + scroll = horizontal pan
        setPan((prev) => ({
          x: prev.x - e.deltaY, // Use deltaY for horizontal scroll (natural scrolling)
          y: prev.y,
        }));
      } else {
        // Regular scroll = pan
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    // CRITICAL: { passive: false } allows preventDefault() to work
    canvasElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvasElement.removeEventListener("wheel", handleWheel);
  }, [canvasElement, zoom, zoomTo]);

  // Handle touch start for two-finger gestures
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        setIsPanning(true);
        // Get distance between two touch points
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        // Get center point between two touches
        lastTouchCenterRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
        panStartPanRef.current = { ...pan };
      }
    },
    [pan],
  );

  // Handle touch move for pan and pinch zoom
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
        e.preventDefault();

        // Get distance between two touch points
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        // Get center point between two touches
        const currentCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };

        // Pinch zoom
        const scale = currentDistance / lastTouchDistanceRef.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * scale));

        // Pan from center movement
        const lastCenter = lastTouchCenterRef.current!;
        const deltaX = currentCenter.x - lastCenter.x;
        const deltaY = currentCenter.y - lastCenter.y;

        // Zoom toward pinch center
        const zoomRatio = newZoom / zoom;
        const newPan = {
          x: currentCenter.x - (currentCenter.x - pan.x) * zoomRatio + deltaX,
          y: currentCenter.y - (currentCenter.y - pan.y) * zoomRatio + deltaY,
        };

        setZoom(newZoom);
        setPan(newPan);

        lastTouchDistanceRef.current = currentDistance;
        lastTouchCenterRef.current = currentCenter;
      }
    },
    [zoom, pan],
  );

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPanning(false);
      lastTouchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
    }
  }, []);

  // Global mouse move and up handlers for panning
  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartPanRef.current.x + deltaX,
        y: panStartPanRef.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focused on input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Space key for pan mode
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      switch (e.key) {
        case "0":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            resetView();
          }
          break;
        case "=":
        case "+":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            zoomTo(zoom * 1.2);
          }
          break;
        case "-":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            zoomTo(zoom / 1.2);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [zoom, zoomTo, resetView]);

  return {
    pan,
    zoom,
    isPanning,
    isSpacePressed,
    setPan,
    setZoom,
    screenToWorld,
    worldToScreen,
    zoomTo,
    resetView,
    fitToBounds,
    centerOn,
    canvasRef,
    handlers: {
      onMouseDown: handleMouseDown,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

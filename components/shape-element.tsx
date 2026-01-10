"use client";

import { Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Element, Session, SessionRole, ShapeData } from "@/db/schema";
import {
  canDeleteElement,
  canEditElement,
  canMoveElement,
} from "@/lib/permissions";

interface Point {
  x: number;
  y: number;
}

interface ShapeElementProps {
  element: Element;
  session: Session;
  userRole: SessionRole | null;
  visitorId: string;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  onUpdateData: (id: string, data: ShapeData) => void;
  onDelete: (id: string) => void;
  onPersistMove: (id: string, x: number, y: number) => void;
  onPersistResize: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  onPersistData: (id: string, data: ShapeData) => void;
  onPersistDelete: (id: string) => void;
  screenToWorld: (screen: Point) => Point;
  zoom: number;
  isSpacePressed?: boolean;
}

const SHAPE_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#6b7280", // gray
  "#ffffff", // white
  "#000000", // black
];

function renderShape(
  shapeType: ShapeData["shapeType"],
  width: number,
  height: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
) {
  const padding = strokeWidth;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  switch (shapeType) {
    case "rectangle":
      return (
        <rect
          x={padding}
          y={padding}
          width={innerWidth}
          height={innerHeight}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          rx={4}
        />
      );
    case "circle":
      return (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={innerWidth / 2}
          ry={innerHeight / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "diamond":
      const diamondPoints = `
        ${width / 2},${padding}
        ${width - padding},${height / 2}
        ${width / 2},${height - padding}
        ${padding},${height / 2}
      `;
      return (
        <polygon
          points={diamondPoints}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case "arrow":
      const arrowHeadSize = Math.min(innerWidth * 0.3, 20);
      const arrowY = height / 2;
      const arrowStartX = padding;
      const arrowEndX = width - padding;
      return (
        <g fill="none" stroke={stroke} strokeWidth={strokeWidth}>
          <line
            x1={arrowStartX}
            y1={arrowY}
            x2={arrowEndX - arrowHeadSize}
            y2={arrowY}
          />
          <polyline
            points={`
              ${arrowEndX - arrowHeadSize},${arrowY - arrowHeadSize / 2}
              ${arrowEndX},${arrowY}
              ${arrowEndX - arrowHeadSize},${arrowY + arrowHeadSize / 2}
            `}
            fill="none"
          />
        </g>
      );
    default:
      return null;
  }
}

export function ShapeElement({
  element,
  session,
  userRole,
  visitorId,
  onMove,
  onResize,
  onUpdateData,
  onDelete,
  onPersistMove,
  onPersistResize,
  onPersistData,
  onPersistDelete,
  screenToWorld,
  zoom,
  isSpacePressed = false,
}: ShapeElementProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const resizeCorner = useRef<string | null>(null);

  const data = element.data as ShapeData;

  // Permissions
  const allowMove = canMoveElement(session, element, visitorId);
  const allowEdit = canEditElement(session, element, visitorId);
  const allowDelete = canDeleteElement(
    session,
    element,
    visitorId,
    userRole ?? "participant",
  );

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!allowMove) return;
    setIsDragging(true);
    startPos.current = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
    const clickWorld = screenToWorld({ x: clientX, y: clientY });
    dragOffset.current = {
      x: clickWorld.x - element.x,
      y: clickWorld.y - element.y,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || isSpacePressed) return;
    e.stopPropagation();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      const touch = e.touches[0];
      handleDragStart(touch.clientX, touch.clientY);
    }
  };

  const handleResizeStart = (
    e: React.MouseEvent | React.TouchEvent,
    corner: string,
  ) => {
    if (!allowMove) return;
    e.stopPropagation();
    setIsResizing(true);
    resizeCorner.current = corner;
    startPos.current = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const clickWorld = screenToWorld({ x: clientX, y: clientY });
    dragOffset.current = { x: clickWorld.x, y: clickWorld.y };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const worldPos = screenToWorld({ x: e.clientX, y: e.clientY });

      if (isDragging) {
        const x = worldPos.x - dragOffset.current.x;
        const y = worldPos.y - dragOffset.current.y;
        onMove(element.id, x, y);
      } else if (isResizing) {
        const deltaX = worldPos.x - dragOffset.current.x;
        const deltaY = worldPos.y - dragOffset.current.y;
        let newX = startPos.current.x;
        let newY = startPos.current.y;
        let newWidth = startPos.current.width;
        let newHeight = startPos.current.height;

        const corner = resizeCorner.current;
        if (corner?.includes("e")) {
          newWidth = Math.max(50, startPos.current.width + deltaX);
        }
        if (corner?.includes("w")) {
          const widthDelta = Math.min(deltaX, startPos.current.width - 50);
          newX = startPos.current.x + widthDelta;
          newWidth = startPos.current.width - widthDelta;
        }
        if (corner?.includes("s")) {
          newHeight = Math.max(50, startPos.current.height + deltaY);
        }
        if (corner?.includes("n")) {
          const heightDelta = Math.min(deltaY, startPos.current.height - 50);
          newY = startPos.current.y + heightDelta;
          newHeight = startPos.current.height - heightDelta;
        }

        onResize(element.id, newX, newY, newWidth, newHeight);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const worldPos = screenToWorld({ x: touch.clientX, y: touch.clientY });

        if (isDragging) {
          const x = worldPos.x - dragOffset.current.x;
          const y = worldPos.y - dragOffset.current.y;
          onMove(element.id, x, y);
        }
      }
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        if (
          element.x !== startPos.current.x ||
          element.y !== startPos.current.y
        ) {
          onPersistMove(element.id, element.x, element.y);
        }
      }
      if (isResizing) {
        setIsResizing(false);
        if (
          element.x !== startPos.current.x ||
          element.y !== startPos.current.y ||
          element.width !== startPos.current.width ||
          element.height !== startPos.current.height
        ) {
          onPersistResize(
            element.id,
            element.x,
            element.y,
            element.width,
            element.height,
          );
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [
    isDragging,
    isResizing,
    element.id,
    element.x,
    element.y,
    element.width,
    element.height,
    onMove,
    onResize,
    onPersistMove,
    onPersistResize,
    screenToWorld,
  ]);

  const handleColorChange = (colorType: "fill" | "stroke", color: string) => {
    const newData = { ...data, [colorType]: color };
    onUpdateData(element.id, newData);
    onPersistData(element.id, newData);
  };

  const handleDelete = () => {
    onDelete(element.id);
    onPersistDelete(element.id);
  };

  const showResizeHandles = isHovered && allowMove;

  return (
    <motion.div
      ref={elementRef}
      className="absolute touch-none group"
      initial={{ x: element.x, y: element.y }}
      animate={{ x: element.x, y: element.y }}
      transition={{
        type: "spring",
        damping: 30,
        mass: 0.8,
        stiffness: 350,
      }}
      style={{
        width: element.width,
        height: element.height,
        cursor: allowMove ? (isDragging ? "grabbing" : "grab") : "default",
        zIndex: isDragging || isResizing ? 1000 : 1,
        pointerEvents: isSpacePressed ? "none" : "auto",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg
        width={element.width}
        height={element.height}
        className="overflow-visible"
      >
        {renderShape(
          data.shapeType,
          element.width,
          element.height,
          data.fill,
          data.stroke,
          data.strokeWidth,
        )}
      </svg>

      {/* Color picker and delete button */}
      {isHovered && (
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg border p-1 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {allowEdit && (
            <>
              {/* Fill color */}
              <Popover>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-6 h-6 rounded border-2 border-muted hover:border-muted-foreground transition-colors"
                          style={{ backgroundColor: data.fill }}
                        />
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">Fill color</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent
                  className="w-auto p-2"
                  align="center"
                  sideOffset={5}
                >
                  <div className="grid grid-cols-5 gap-1">
                    {SHAPE_COLORS.map((color) => (
                      <button
                        key={`fill-${color}`}
                        type="button"
                        className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                        style={{
                          backgroundColor: color,
                          borderColor: data.fill === color ? "#000" : "#ccc",
                        }}
                        onClick={() => handleColorChange("fill", color)}
                      />
                    ))}
                    <button
                      type="button"
                      className="w-6 h-6 rounded border hover:scale-110 transition-transform relative overflow-hidden"
                      style={{
                        borderColor:
                          data.fill === "transparent" ? "#000" : "#ccc",
                      }}
                      onClick={() => handleColorChange("fill", "transparent")}
                    >
                      <div className="absolute inset-0 bg-white" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-500 rotate-45" />
                      </div>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Stroke color */}
              <Popover>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-6 h-6 rounded border-2 border-muted hover:border-muted-foreground transition-colors flex items-center justify-center"
                          style={{ backgroundColor: "transparent" }}
                        >
                          <div
                            className="w-4 h-4 rounded-sm border-2"
                            style={{ borderColor: data.stroke }}
                          />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">Stroke color</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent
                  className="w-auto p-2"
                  align="center"
                  sideOffset={5}
                >
                  <div className="grid grid-cols-5 gap-1">
                    {SHAPE_COLORS.map((color) => (
                      <button
                        key={`stroke-${color}`}
                        type="button"
                        className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                        style={{
                          backgroundColor: color,
                          borderColor: data.stroke === color ? "#000" : "#ccc",
                        }}
                        onClick={() => handleColorChange("stroke", color)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}

          {allowDelete && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Delete</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Resize handles */}
      {showResizeHandles && (
        <>
          <div
            className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-nw-resize"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
            onTouchStart={(e) => handleResizeStart(e, "nw")}
          />
          <div
            className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-ne-resize"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
            onTouchStart={(e) => handleResizeStart(e, "ne")}
          />
          <div
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-sw-resize"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
            onTouchStart={(e) => handleResizeStart(e, "sw")}
          />
          <div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-se-resize"
            onMouseDown={(e) => handleResizeStart(e, "se")}
            onTouchStart={(e) => handleResizeStart(e, "se")}
          />
          <div
            className="absolute top-1/2 -left-1 w-2 h-6 -translate-y-1/2 bg-primary/50 rounded-full cursor-w-resize"
            onMouseDown={(e) => handleResizeStart(e, "w")}
            onTouchStart={(e) => handleResizeStart(e, "w")}
          />
          <div
            className="absolute top-1/2 -right-1 w-2 h-6 -translate-y-1/2 bg-primary/50 rounded-full cursor-e-resize"
            onMouseDown={(e) => handleResizeStart(e, "e")}
            onTouchStart={(e) => handleResizeStart(e, "e")}
          />
          <div
            className="absolute -top-1 left-1/2 w-6 h-2 -translate-x-1/2 bg-primary/50 rounded-full cursor-n-resize"
            onMouseDown={(e) => handleResizeStart(e, "n")}
            onTouchStart={(e) => handleResizeStart(e, "n")}
          />
          <div
            className="absolute -bottom-1 left-1/2 w-6 h-2 -translate-x-1/2 bg-primary/50 rounded-full cursor-s-resize"
            onMouseDown={(e) => handleResizeStart(e, "s")}
            onTouchStart={(e) => handleResizeStart(e, "s")}
          />
        </>
      )}
    </motion.div>
  );
}

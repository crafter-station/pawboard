"use client";

import { Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Element, Session, SessionRole, TextData } from "@/db/schema";
import {
  canDeleteElement,
  canEditElement,
  canMoveElement,
} from "@/lib/permissions";

interface Point {
  x: number;
  y: number;
}

interface TextElementProps {
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
  onUpdateData: (id: string, data: TextData) => void;
  onDelete: (id: string) => void;
  onPersistMove: (id: string, x: number, y: number) => void;
  onPersistResize: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  onPersistData: (id: string, data: TextData) => void;
  onPersistDelete: (id: string) => void;
  screenToWorld: (screen: Point) => Point;
  zoom: number;
  isSpacePressed?: boolean;
}

export function TextElement({
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
}: TextElementProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const resizeCorner = useRef<string | null>(null);

  const data = element.data as TextData;

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
    if (!allowMove || isEditing) return;
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
    if (e.button === 1 || isSpacePressed || isEditing) return;
    e.stopPropagation();
    handleDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && !isEditing) {
      e.stopPropagation();
      const touch = e.touches[0];
      handleDragStart(touch.clientX, touch.clientY);
    }
  };

  // Resize handlers
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
          newWidth = Math.max(100, startPos.current.width + deltaX);
        }
        if (corner?.includes("w")) {
          const widthDelta = Math.min(deltaX, startPos.current.width - 100);
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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateData(element.id, { ...data, content: e.target.value });
  };

  const handleContentBlur = () => {
    setIsEditing(false);
    onPersistData(element.id, data);
  };

  const handleDoubleClick = () => {
    if (allowEdit) {
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    onDelete(element.id);
    onPersistDelete(element.id);
  };

  const showResizeHandles = isHovered && allowMove && !isEditing;

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
        cursor:
          allowMove && !isEditing
            ? isDragging
              ? "grabbing"
              : "grab"
            : "default",
        zIndex: isDragging || isResizing || isEditing ? 1000 : 1,
        pointerEvents: isSpacePressed ? "none" : "auto",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="w-full h-full rounded-md border border-transparent hover:border-border/50 bg-transparent transition-colors"
        style={{
          borderColor: isEditing ? "hsl(var(--border))" : undefined,
        }}
      >
        {isEditing ? (
          <Textarea
            autoFocus
            value={data.content}
            onChange={handleContentChange}
            onBlur={handleContentBlur}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="w-full h-full resize-none border-none bg-transparent p-2 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{
              fontSize: data.fontSize,
              fontWeight: data.fontWeight,
              textAlign: data.textAlign,
              color: data.color,
            }}
            placeholder="Type text..."
          />
        ) : (
          <div
            className="w-full h-full p-2 overflow-hidden whitespace-pre-wrap break-words"
            style={{
              fontSize: data.fontSize,
              fontWeight: data.fontWeight,
              textAlign: data.textAlign,
              color: data.color,
            }}
          >
            {data.content || (
              <span className="text-muted-foreground/50">
                Double-click to edit
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete button */}
      {allowDelete && isHovered && !isEditing && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute -top-3 -right-3 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Resize handles */}
      {showResizeHandles && (
        <>
          {/* Corners */}
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
          {/* Edges */}
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

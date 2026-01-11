import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@/db/schema";

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseMarqueeSelectionOptions {
  cards: Card[];
  screenToWorld: (screen: Point) => Point;
  cardWidth: number;
  cardHeight: number;
  isSpacePressed?: boolean;
}

const DRAG_THRESHOLD = 5;

export function useMarqueeSelection({
  cards,
  screenToWorld,
  cardWidth,
  cardHeight,
  isSpacePressed = false,
}: UseMarqueeSelectionOptions) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectionRect, setSelectionRect] = useState<Rect | null>(null);
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);

  const startScreenPosRef = useRef<Point | null>(null);
  const startWorldPosRef = useRef<Point | null>(null);
  const currentScreenPosRef = useRef<Point | null>(null);
  const hasDraggedPastThresholdRef = useRef(false);

  // Check if a rectangle intersects with a card
  const rectanglesIntersect = useCallback(
    (rect1: Rect, rect2: Rect): boolean => {
      return !(
        rect1.x + rect1.width < rect2.x ||
        rect2.x + rect2.width < rect1.x ||
        rect1.y + rect1.height < rect2.y ||
        rect2.y + rect2.height < rect1.y
      );
    },
    [],
  );

  // Check if a card is fully contained in a rectangle
  const rectangleContainsCard = useCallback(
    (rect: Rect, cardX: number, cardY: number): boolean => {
      return (
        cardX >= rect.x &&
        cardY >= rect.y &&
        cardX + cardWidth <= rect.x + rect.width &&
        cardY + cardHeight <= rect.y + rect.height
      );
    },
    [cardWidth, cardHeight],
  );

  // Calculate which cards are selected based on the selection rectangle
  const getSelectedCards = useCallback(
    (rect: Rect, isLeftToRight: boolean): Set<string> => {
      const selected = new Set<string>();

      for (const card of cards) {
        const cardRect: Rect = {
          x: card.x,
          y: card.y,
          width: cardWidth,
          height: cardHeight,
        };

        if (isLeftToRight) {
          // Left-to-right: select cards that intersect
          if (rectanglesIntersect(rect, cardRect)) {
            selected.add(card.id);
          }
        } else {
          // Right-to-left: select only cards fully contained
          if (rectangleContainsCard(rect, card.x, card.y)) {
            selected.add(card.id);
          }
        }
      }

      return selected;
    },
    [cards, cardWidth, cardHeight, rectanglesIntersect, rectangleContainsCard],
  );

  const startSelection = useCallback(
    (screenX: number, screenY: number) => {
      // Don't start selection if space is pressed (pan mode)
      if (isSpacePressed) return;

      startScreenPosRef.current = { x: screenX, y: screenY };
      startWorldPosRef.current = screenToWorld({ x: screenX, y: screenY });
      currentScreenPosRef.current = { x: screenX, y: screenY };
      hasDraggedPastThresholdRef.current = false;
      setIsMarqueeActive(true); // Trigger effect to attach event listeners
      // Don't set isSelecting yet - wait for drag threshold
    },
    [screenToWorld, isSpacePressed],
  );

  const updateSelection = useCallback(
    (screenX: number, screenY: number) => {
      if (!startScreenPosRef.current || !startWorldPosRef.current) return;

      currentScreenPosRef.current = { x: screenX, y: screenY };

      // Check if we've dragged past the threshold
      if (!hasDraggedPastThresholdRef.current) {
        const dx = Math.abs(screenX - startScreenPosRef.current.x);
        const dy = Math.abs(screenY - startScreenPosRef.current.y);

        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
          // Haven't moved enough yet
          return;
        }

        // Threshold exceeded, now it's a marquee selection
        hasDraggedPastThresholdRef.current = true;
        setIsSelecting(true);
      }

      // Convert current position to world coordinates
      const currentWorldPos = screenToWorld({ x: screenX, y: screenY });

      // Calculate selection rectangle in world coordinates
      const minX = Math.min(startWorldPosRef.current.x, currentWorldPos.x);
      const minY = Math.min(startWorldPosRef.current.y, currentWorldPos.y);
      const maxX = Math.max(startWorldPosRef.current.x, currentWorldPos.x);
      const maxY = Math.max(startWorldPosRef.current.y, currentWorldPos.y);

      const rect: Rect = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };

      setSelectionRect(rect);

      // Determine selection mode based on drag direction
      const isLeftToRight = currentWorldPos.x >= startWorldPosRef.current.x;

      // Calculate and update selected cards
      const selected = getSelectedCards(rect, isLeftToRight);
      setSelectedCardIds(selected);
    },
    [screenToWorld, getSelectedCards],
  );

  const endSelection = useCallback(() => {
    // If we didn't drag past threshold, treat it as a click to deselect
    if (!hasDraggedPastThresholdRef.current) {
      setSelectedCardIds(new Set());
    }

    // Reset refs
    startScreenPosRef.current = null;
    startWorldPosRef.current = null;
    currentScreenPosRef.current = null;
    hasDraggedPastThresholdRef.current = false;
    setIsSelecting(false);
    setSelectionRect(null);
    setIsMarqueeActive(false); // Trigger effect cleanup
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCardIds(new Set());
    setIsSelecting(false);
    setSelectionRect(null);
    startScreenPosRef.current = null;
    startWorldPosRef.current = null;
    currentScreenPosRef.current = null;
    hasDraggedPastThresholdRef.current = false;
    setIsMarqueeActive(false); // Ensure listeners are cleaned up
  }, []);

  // Global mouse move and up handlers for marquee selection
  useEffect(() => {
    if (!isMarqueeActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateSelection(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      endSelection();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isMarqueeActive, updateSelection, endSelection]);

  return {
    isSelecting,
    selectionRect,
    selectedCardIds,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    setSelectedCardIds,
  };
}

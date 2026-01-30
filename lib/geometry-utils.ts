import type { Card } from "@/db/schema";

/**
 * Check if a point is inside a card's bounding box
 * @param point - The point to check (e.g., thread trigger center)
 * @param card - The card to check against
 * @param padding - Optional padding to expand the hit area (default: 0)
 * @returns true if point is inside the card
 */
export function isPointInsideCard(
  point: { x: number; y: number },
  card: Card,
  padding = 0,
): boolean {
  return (
    point.x >= card.x - padding &&
    point.x <= card.x + card.width + padding &&
    point.y >= card.y - padding &&
    point.y <= card.y + card.height + padding
  );
}

/**
 * Find which card (if any) a point is over
 * @param point - The point to check
 * @param cards - Array of cards to check against
 * @param excludeCardId - Optional card ID to exclude (e.g., when thread is already attached)
 * @returns The card the point is over, or null
 */
export function findCardAtPoint(
  point: { x: number; y: number },
  cards: Card[],
  excludeCardId?: string,
): Card | null {
  // Check cards in reverse order (last rendered = on top)
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i];
    if (excludeCardId && card.id === excludeCardId) continue;
    if (isPointInsideCard(point, card)) {
      return card;
    }
  }
  return null;
}

/**
 * Thread bubble dimensions (approximate)
 */
export const THREAD_BUBBLE_SIZE = { width: 48, height: 40 };

/**
 * Calculate thread bubble trigger center position
 */
export function getThreadBubbleCenter(position: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return {
    x: position.x + THREAD_BUBBLE_SIZE.width / 2,
    y: position.y + THREAD_BUBBLE_SIZE.height / 2,
  };
}

/**
 * Calculate the position for a detached thread (snaps outside card boundary)
 * @param cardPosition - The card's position
 * @param cardWidth - The card's width
 * @returns Position just outside the card's right edge
 */
export function getDetachPosition(
  cardPosition: { x: number; y: number },
  cardWidth: number,
): { x: number; y: number } {
  return {
    x: cardPosition.x + cardWidth + 20, // 20px outside right edge
    y: cardPosition.y - 10, // Slightly above card top
  };
}

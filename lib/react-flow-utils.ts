import type { Node } from "@xyflow/react";
import type { Card, Session, SessionRole } from "@/db/schema";

/**
 * Data stored in each IdeaCard node
 */
export interface IdeaCardNodeData extends Record<string, unknown> {
  card: Card;
  session: Session;
  userRole: SessionRole | null;
  visitorId: string;
  creatorName: string;
  // UI state
  isEditing: boolean;
  autoFocus: boolean;
}

/**
 * Type for IdeaCard nodes in React Flow
 */
export type IdeaCardNode = Node<IdeaCardNodeData, "ideaCard">;

/**
 * Convert a database Card to a React Flow Node
 */
export function cardToNode(
  card: Card,
  session: Session,
  userRole: SessionRole | null,
  visitorId: string,
  creatorName: string,
  options?: {
    autoFocus?: boolean;
    isEditing?: boolean;
  },
): IdeaCardNode {
  return {
    id: card.id,
    type: "ideaCard",
    position: { x: card.x, y: card.y },
    data: {
      card,
      session,
      userRole,
      visitorId,
      creatorName,
      isEditing: options?.isEditing ?? false,
      autoFocus: options?.autoFocus ?? false,
    },
    draggable: true,
    selectable: true,
  };
}

/**
 * Convert multiple cards to React Flow nodes
 */
export function cardsToNodes(
  cards: Card[],
  session: Session,
  userRole: SessionRole | null,
  visitorId: string,
  getCreatorName: (userId: string) => string,
  autoFocusCardId?: string | null,
): IdeaCardNode[] {
  return cards.map((card) =>
    cardToNode(
      card,
      session,
      userRole,
      visitorId,
      getCreatorName(card.createdById),
      {
        autoFocus: card.id === autoFocusCardId,
      },
    ),
  );
}

/**
 * Update node data while preserving UI state
 */
export function updateNodeData(
  nodes: IdeaCardNode[],
  cards: Card[],
  session: Session,
  userRole: SessionRole | null,
  visitorId: string,
  getCreatorName: (userId: string) => string,
): IdeaCardNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Update existing nodes and add new ones
  const updatedNodes: IdeaCardNode[] = cards.map((card) => {
    const existingNode = nodeMap.get(card.id);
    if (existingNode) {
      // Preserve UI state (isEditing) while updating card data
      return {
        ...existingNode,
        position: { x: card.x, y: card.y },
        data: {
          ...existingNode.data,
          card,
          session,
          userRole,
          visitorId,
          creatorName: getCreatorName(card.createdById),
        },
      };
    }
    // New card - create new node
    return cardToNode(
      card,
      session,
      userRole,
      visitorId,
      getCreatorName(card.createdById),
    );
  });

  return updatedNodes;
}

/**
 * Extract card data from a node
 */
export function nodeToCard(node: IdeaCardNode): Card {
  return {
    ...node.data.card,
    x: node.position.x,
    y: node.position.y,
  };
}

// Default card dimensions for new cards
export const DEFAULT_CARD_WIDTH = 224;
export const DEFAULT_CARD_HEIGHT = 160;

// Keep legacy exports for backwards compatibility
export const CARD_WIDTH = DEFAULT_CARD_WIDTH;
export const CARD_HEIGHT = DEFAULT_CARD_HEIGHT;
export const CARD_WIDTH_MOBILE = 160;
export const CARD_HEIGHT_MOBILE = 120;

/**
 * Get default card dimensions based on screen size
 */
export function getCardDimensions(isMobile: boolean) {
  return {
    width: isMobile ? CARD_WIDTH_MOBILE : DEFAULT_CARD_WIDTH,
    height: isMobile ? CARD_HEIGHT_MOBILE : DEFAULT_CARD_HEIGHT,
  };
}

/**
 * Calculate bounds for fitting all cards in view
 * Uses each card's individual dimensions
 */
export function calculateCardsBounds(
  cards: Card[],
  _isMobile?: boolean,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (cards.length === 0) return null;

  return cards.reduce(
    (acc, card) => ({
      minX: Math.min(acc.minX, card.x),
      minY: Math.min(acc.minY, card.y),
      maxX: Math.max(acc.maxX, card.x + card.width),
      maxY: Math.max(acc.maxY, card.y + card.height),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

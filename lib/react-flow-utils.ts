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
  isExpanded: boolean;
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
    isExpanded?: boolean;
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
      isExpanded: options?.isExpanded ?? false,
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
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Update existing nodes and add new ones
  const updatedNodes: IdeaCardNode[] = cards.map((card) => {
    const existingNode = nodeMap.get(card.id);
    if (existingNode) {
      // Preserve UI state (isEditing, isExpanded) while updating card data
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

// Card dimensions for calculations
export const CARD_WIDTH = 224;
export const CARD_HEIGHT = 160;
export const CARD_WIDTH_MOBILE = 160;
export const CARD_HEIGHT_MOBILE = 120;

/**
 * Get card dimensions based on screen size
 */
export function getCardDimensions(isMobile: boolean) {
  return {
    width: isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH,
    height: isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT,
  };
}

/**
 * Calculate bounds for fitting all cards in view
 */
export function calculateCardsBounds(
  cards: Card[],
  isMobile: boolean,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (cards.length === 0) return null;

  const { width, height } = getCardDimensions(isMobile);

  return cards.reduce(
    (acc, card) => ({
      minX: Math.min(acc.minX, card.x),
      minY: Math.min(acc.minY, card.y),
      maxX: Math.max(acc.maxX, card.x + width),
      maxY: Math.max(acc.maxY, card.y + height),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

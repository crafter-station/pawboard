import type { Node } from "@xyflow/react";
import type { ThreadNodeData } from "@/components/threads";
import type {
  Card,
  Session,
  SessionRole,
  ThreadWithDetails,
} from "@/db/schema";

/**
 * Thread handler functions for card-attached threads
 */
export interface CardThreadHandlers {
  onAddComment: (threadId: string, content: string) => Promise<void>;
  onDeleteComment: (threadId: string, commentId: string) => Promise<void>;
  onResolve: (threadId: string, isResolved: boolean) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  onDetach?: (
    threadId: string,
    position: { x: number; y: number },
  ) => Promise<void>;
  /** Convert screen coordinates to flow (canvas) coordinates for accurate positioning */
  screenToFlowPosition?: (position: { x: number; y: number }) => {
    x: number;
    y: number;
  };
}

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
  // Card-attached threads
  attachedThreads?: ThreadWithDetails[];
  threadHandlers?: CardThreadHandlers;
  // Magnetic thread attachment feedback
  magneticHighlight?: boolean;
  // Card editors (users who have edited this card)
  editors?: Array<{ userId: string; username: string }>;
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
    attachedThreads?: ThreadWithDetails[];
    threadHandlers?: CardThreadHandlers;
    magneticHighlight?: boolean;
    editors?: Array<{ userId: string; username: string }>;
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
      attachedThreads: options?.attachedThreads,
      threadHandlers: options?.threadHandlers,
      magneticHighlight: options?.magneticHighlight ?? false,
      editors: options?.editors,
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
  threadsByCardId?: Map<string, ThreadWithDetails[]>,
  threadHandlers?: CardThreadHandlers,
  magneticHighlightCardId?: string | null,
  sessionEditors?: Record<string, Array<{ userId: string; username: string }>>,
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
        attachedThreads: threadsByCardId?.get(card.id),
        threadHandlers,
        magneticHighlight: card.id === magneticHighlightCardId,
        editors: sessionEditors?.[card.id],
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
  threadsByCardId?: Map<string, ThreadWithDetails[]>,
  threadHandlers?: CardThreadHandlers,
  magneticHighlightCardId?: string | null,
  sessionEditors?: Record<string, Array<{ userId: string; username: string }>>,
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
          attachedThreads: threadsByCardId?.get(card.id),
          threadHandlers,
          magneticHighlight: card.id === magneticHighlightCardId,
          editors: sessionEditors?.[card.id],
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
      {
        attachedThreads: threadsByCardId?.get(card.id),
        threadHandlers,
        magneticHighlight: card.id === magneticHighlightCardId,
        editors: sessionEditors?.[card.id],
      },
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

/**
 * Thread node type for React Flow
 */
export type ThreadNode = Node<ThreadNodeData, "thread">;

/**
 * Convert a thread to a React Flow node
 */
export function threadToNode(
  thread: ThreadWithDetails,
  userRole: SessionRole | null,
  visitorId: string,
  sessionLocked: boolean,
  handlers: {
    onAddComment: (threadId: string, content: string) => Promise<void>;
    onDeleteComment: (threadId: string, commentId: string) => Promise<void>;
    onResolve: (threadId: string, isResolved: boolean) => Promise<void>;
    onDeleteThread: (threadId: string) => Promise<void>;
  },
  collisionBoundary?: Element | null,
): ThreadNode {
  // For card-attached threads, use card position (needs to be calculated elsewhere)
  // For canvas threads, use thread's x, y
  const x = thread.x ?? 0;
  const y = thread.y ?? 0;

  return {
    id: `thread-${thread.id}`,
    type: "thread",
    position: { x, y },
    data: {
      thread,
      userRole,
      visitorId,
      sessionLocked,
      collisionBoundary,
      onAddComment: handlers.onAddComment,
      onDeleteComment: handlers.onDeleteComment,
      onResolve: handlers.onResolve,
      onDeleteThread: handlers.onDeleteThread,
    },
    draggable: !thread.cardId, // Only canvas threads are draggable
    selectable: true,
    zIndex: 1000, // Thread nodes should appear above cards
  };
}

/**
 * Convert multiple threads to React Flow nodes
 * Only includes canvas threads (not card-attached)
 */
export function threadsToNodes(
  threads: ThreadWithDetails[],
  userRole: SessionRole | null,
  visitorId: string,
  sessionLocked: boolean,
  handlers: {
    onAddComment: (threadId: string, content: string) => Promise<void>;
    onDeleteComment: (threadId: string, commentId: string) => Promise<void>;
    onResolve: (threadId: string, isResolved: boolean) => Promise<void>;
    onDeleteThread: (threadId: string) => Promise<void>;
  },
  collisionBoundary?: Element | null,
): ThreadNode[] {
  // Only include canvas-positioned threads (not card-attached)
  return threads
    .filter((t) => !t.cardId && t.x !== null && t.y !== null)
    .map((thread) =>
      threadToNode(
        thread,
        userRole,
        visitorId,
        sessionLocked,
        handlers,
        collisionBoundary,
      ),
    );
}

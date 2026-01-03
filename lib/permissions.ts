import type { Card, Session, SessionRole } from "@/db/schema";

/**
 * Check if user can add a new card to the session
 * - Allowed when session is not locked
 */
export function canAddCard(session: Session): boolean {
  return !session.isLocked;
}

/**
 * Check if user can edit a card's content
 * - Allowed when session is not locked AND user is the card creator
 */
export function canEditCard(
  session: Session,
  card: Card,
  userId: string,
): boolean {
  return !session.isLocked && card.createdById === userId;
}

/**
 * Check if user can move a card
 * - Never allowed when session is locked
 * - When unlocked: depends on movePermission setting
 *   - "creator": only card creator can move
 *   - "everyone": anyone can move any card
 */
export function canMoveCard(
  session: Session,
  card: Card,
  userId: string,
): boolean {
  if (session.isLocked) return false;

  if (session.movePermission === "everyone") return true;

  // movePermission === "creator"
  return card.createdById === userId;
}

/**
 * Check if user can delete a card
 * - Session creator can ALWAYS delete any card (even when locked)
 * - When locked: only session creator can delete
 * - When unlocked: depends on deletePermission setting
 *   - "creator": only card creator can delete their own cards
 *   - "everyone": anyone can delete any card
 */
export function canDeleteCard(
  session: Session,
  card: Card,
  userId: string,
  userRole: SessionRole,
): boolean {
  // Session creator can always delete any card
  if (userRole === "creator") return true;

  // When locked, only session creator can delete (handled above)
  if (session.isLocked) return false;

  if (session.deletePermission === "everyone") return true;

  // deletePermission === "creator"
  return card.createdById === userId;
}

/**
 * Check if user can change a card's color
 * - Allowed when session is not locked AND user is the card creator
 */
export function canChangeColor(
  session: Session,
  card: Card,
  userId: string,
): boolean {
  return !session.isLocked && card.createdById === userId;
}

/**
 * Check if user can refine a card with AI
 * - Allowed when session is not locked AND user is the card creator
 */
export function canRefine(
  session: Session,
  card: Card,
  userId: string,
): boolean {
  return !session.isLocked && card.createdById === userId;
}

/**
 * Check if user can vote on a card
 * - Allowed when session is not locked AND user is NOT the card creator
 */
export function canVote(session: Session, card: Card, userId: string): boolean {
  return !session.isLocked && card.createdById !== userId;
}

/**
 * Check if user can configure session settings
 * - Only session creator can configure settings
 */
export function canConfigureSession(userRole: SessionRole): boolean {
  return userRole === "creator";
}

/**
 * Check if user can delete the session
 * - Only session creator can delete the session
 */
export function canDeleteSession(userRole: SessionRole): boolean {
  return userRole === "creator";
}

/**
 * Check if user can edit the session name
 * - Only session creator can edit session name
 */
export function canEditSessionName(userRole: SessionRole): boolean {
  return userRole === "creator";
}

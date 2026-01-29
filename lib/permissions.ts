import type { Card, Session, SessionRole } from "@/db/schema";

/**
 * Check if user can add a new card to the session
 * - Allowed when session is not locked, OR user is session creator
 */
export function canAddCard(session: Session, userRole: SessionRole): boolean {
  return !session.isLocked || userRole === "creator";
}

/**
 * Check if user can edit a card's content
 * - Allowed when session is not locked (anyone can edit any card)
 * - Session creator can always edit when locked
 */
export function canEditCard(
  session: Session,
  _card: Card,
  _userId: string,
  userRole: SessionRole,
): boolean {
  return !session.isLocked || userRole === "creator";
}

/**
 * Check if user can move a card
 * - Allowed when session is not locked (anyone can move any card)
 * - Session creator can always move when locked
 */
export function canMoveCard(
  session: Session,
  _card: Card,
  _userId: string,
  userRole: SessionRole,
): boolean {
  return !session.isLocked || userRole === "creator";
}

/**
 * Check if user can delete a card
 * - Allowed when session is not locked (anyone can delete any card)
 * - Session creator can always delete when locked
 */
export function canDeleteCard(
  session: Session,
  _card: Card,
  _userId: string,
  userRole: SessionRole,
): boolean {
  return !session.isLocked || userRole === "creator";
}

/**
 * Check if user can change a card's color
 * - Allowed when session is not locked (anyone can change color)
 * - Session creator can always change when locked
 */
export function canChangeColor(
  session: Session,
  _card: Card,
  _userId: string,
  userRole: SessionRole,
): boolean {
  return !session.isLocked || userRole === "creator";
}

/**
 * Check if user can refine a card with AI
 * - Allowed when session is not locked (anyone can refine any card)
 * - Session creator can always refine when locked
 */
export function canRefine(
  session: Session,
  _card: Card,
  _userId: string,
  userRole: SessionRole,
): boolean {
  return !session.isLocked || userRole === "creator";
}

/**
 * Check if user can vote on a card
 * - Allowed when session is not locked AND user is NOT the card creator
 * - Session creator can vote on others' cards even when locked
 */
export function canVote(
  session: Session,
  card: Card,
  userId: string,
  userRole: SessionRole,
): boolean {
  const isNotOwnCard = card.createdById !== userId;
  if (userRole === "creator") return isNotOwnCard;
  return !session.isLocked && isNotOwnCard;
}

/**
 * Check if user can react to a card with emojis
 * - Allowed when session is not locked AND user is NOT the card creator
 * - Session creator can react to others' cards even when locked
 */
export function canReact(
  session: Session,
  card: Card,
  userId: string,
  userRole: SessionRole,
): boolean {
  const isNotOwnCard = card.createdById !== userId;
  if (userRole === "creator") return isNotOwnCard;
  return !session.isLocked && isNotOwnCard;
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

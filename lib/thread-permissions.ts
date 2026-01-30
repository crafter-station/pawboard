import type { Comment, Session, SessionRole, Thread } from "@/db/schema";

/**
 * Check if user can create a thread in the session.
 * Allowed when session is not locked, or user is the creator.
 */
export function canCreateThread(
  session: Session,
  userRole: SessionRole | null,
): boolean {
  if (!session.isLocked) return true;
  return userRole === "creator";
}

/**
 * Check if user can resolve/unresolve a thread.
 * Thread creator or session creator can resolve.
 */
export function canResolveThread(
  thread: Thread,
  userId: string,
  userRole: SessionRole | null,
): boolean {
  return thread.createdById === userId || userRole === "creator";
}

/**
 * Check if user can delete a thread.
 * Thread creator or session creator can delete.
 */
export function canDeleteThread(
  thread: Thread,
  userId: string,
  userRole: SessionRole | null,
): boolean {
  return thread.createdById === userId || userRole === "creator";
}

/**
 * Check if user can delete a comment.
 * Comment author or session creator can delete.
 */
export function canDeleteComment(
  comment: Comment,
  userId: string,
  userRole: SessionRole | null,
): boolean {
  return comment.createdById === userId || userRole === "creator";
}

/**
 * Check if user can add a comment to a thread.
 * Same rules as creating a thread.
 */
export function canAddComment(
  session: Session,
  userRole: SessionRole | null,
): boolean {
  return canCreateThread(session, userRole);
}

/**
 * Validation constraints for comments.
 */
export const COMMENT_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 2000,
} as const;

/**
 * Validate comment content.
 */
export function validateCommentContent(content: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = content.trim();

  if (trimmed.length < COMMENT_CONSTRAINTS.MIN_LENGTH) {
    return { valid: false, error: "Comment cannot be empty" };
  }

  if (trimmed.length > COMMENT_CONSTRAINTS.MAX_LENGTH) {
    return {
      valid: false,
      error: `Comment must be at most ${COMMENT_CONSTRAINTS.MAX_LENGTH} characters`,
    };
  }

  return { valid: true };
}

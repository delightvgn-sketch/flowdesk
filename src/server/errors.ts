import "server-only";

import { ForbiddenError } from "@/lib/permissions";
import { NoWorkspaceError, UnauthorizedError } from "@/server/auth/session";

export class NotFoundError extends Error {
  constructor(what = "That item") {
    super(`${what} could not be found. It may have been deleted, or you may not have access.`);
    this.name = "NotFoundError";
  }
}

/** A failure whose message is safe and useful to show to the user as-is. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

type PgLikeError = { code?: string; constraint_name?: string; message?: string };

function pgCause(error: unknown): PgLikeError | null {
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i++) {
    if (typeof current === "object" && current !== null && "code" in current && typeof current.code === "string") {
      return current as PgLikeError;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Translate any thrown error into a message that is safe to show. Raw database
 * errors are logged server-side and never forwarded to the browser.
 */
export function toUserMessage(error: unknown): string {
  if (
    error instanceof UserFacingError ||
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof UnauthorizedError ||
    error instanceof NoWorkspaceError
  ) {
    return error.message;
  }

  const pg = pgCause(error);
  switch (pg?.code) {
    case "42501": // insufficient_privilege / RLS violation
      return "You don't have permission to do that.";
    case "23505":
      return "Something with those details already exists.";
    case "23503":
      return "This item is linked to other records and can't be changed that way.";
    case "23514":
    case "22023":
      return "Some of the values aren't valid. Please check and try again.";
  }

  console.error("[flowdesk] unexpected error", error);
  return "Something went wrong on our side. Please try again.";
}

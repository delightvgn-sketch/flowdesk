/** Shape returned by every server action (see src/server/actions/safe-action.ts). */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { assertCan, type Permission } from "@/lib/permissions";
import { getAppContext, type AppContext } from "@/server/auth/session";
import { toUserMessage } from "@/server/errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

type Options<S extends z.ZodType> = {
  schema: S;
  /** Checked against the caller's role in the active workspace before anything runs. */
  permission?: Permission;
};

/**
 * Every mutation in FlowDesk goes through this wrapper, which:
 *  1. resolves the signed-in user and active workspace (never trusting IDs from the browser),
 *  2. checks the role permission,
 *  3. validates input with the shared Zod schema,
 *  4. runs the handler — whose queries execute under row level security —
 *  5. maps failures to safe, human-readable messages.
 */
export function createAction<S extends z.ZodType, R>(
  options: Options<S>,
  handler: (input: z.output<S>, ctx: AppContext) => Promise<R>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<R>> => {
    try {
      const ctx = await getAppContext();
      if (options.permission) assertCan(ctx.role, options.permission);

      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        const flat = z.flattenError(parsed.error);
        return {
          ok: false,
          error: flat.formErrors[0] ?? "Please fix the highlighted fields.",
          fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
        };
      }

      return { ok: true, data: await handler(parsed.data, ctx) };
    } catch (error) {
      unstable_rethrow(error);
      return { ok: false, error: toUserMessage(error) };
    }
  };
}

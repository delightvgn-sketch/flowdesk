import "server-only";

import { gateway } from "ai";

import { env, features } from "@/server/env";
import { UserFacingError } from "@/server/errors";

export const AI_NOT_CONFIGURED =
  "FlowDesk AI isn't configured on this deployment. Add an AI_GATEWAY_API_KEY (or deploy on Vercel with AI Gateway enabled) to turn it on.";

/** The language model behind FlowDesk AI, routed through Vercel AI Gateway. */
export function aiModel() {
  if (!features.ai()) throw new UserFacingError(AI_NOT_CONFIGURED);
  return gateway(env.aiModel());
}

export function friendlyAiError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  console.error("[flowdesk] AI error", error);
  const message = error instanceof Error ? error.message : "";
  if (/401|403|unauthori[sz]ed|api key/i.test(message)) return "The AI provider rejected the request. Check the AI Gateway key.";
  if (/429|rate/i.test(message)) return "FlowDesk AI is busy right now. Please try again in a moment.";
  return "FlowDesk AI couldn't complete that request. Please try again.";
}

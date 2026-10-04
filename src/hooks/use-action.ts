"use client";

import { useCallback, useTransition } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

type Options<R> = {
  /** Toast shown on success. Omit for silent actions (e.g. drag & drop). */
  success?: string | ((data: R) => string);
  onSuccess?: (data: R) => void;
  /** Receives server-side field errors — pair with `applyFieldErrors` for forms. */
  onError?: (result: Extract<ActionResult<R>, { ok: false }>) => void;
};

/**
 * Call a server action from a client component with pending state, toasts and
 * server-side field errors. Keeps every mutation's UX consistent.
 */
export function useAction<I, R>(action: (input: I) => Promise<ActionResult<R>>, options: Options<R> = {}) {
  const [pending, startTransition] = useTransition();
  const { success, onSuccess, onError } = options;

  const execute = useCallback(
    (input: I) =>
      new Promise<ActionResult<R>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<R>;
          try {
            result = await action(input);
          } catch {
            result = { ok: false, error: "Network error — please check your connection and try again." };
          }
          if (result.ok) {
            const message = typeof success === "function" ? success(result.data) : success;
            if (message) toast.success(message);
            onSuccess?.(result.data);
          } else {
            toast.error(result.error);
            onError?.(result);
          }
          resolve(result);
        });
      }),
    [action, success, onSuccess, onError],
  );

  return { execute, pending };
}

/** Map server-side Zod field errors onto a react-hook-form instance. */
export function applyFieldErrors<T extends FieldValues>(
  form: { setError: UseFormSetError<T> },
  fieldErrors: Record<string, string[] | undefined> | undefined,
) {
  if (!fieldErrors) return;
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) form.setError(field as Path<T>, { type: "server", message: messages[0] });
  }
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues } from "react-hook-form";
import type { z } from "zod";

/**
 * react-hook-form bound to a shared Zod schema. Field values use the schema's
 * input type; `handleSubmit` receives the parsed (transformed) output — the
 * same shape the server action validates again.
 */
export function useZodForm<S extends z.ZodType<unknown, Record<string, unknown>>>(
  schema: S,
  defaultValues: DefaultValues<z.input<S>>,
) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never),
    defaultValues,
  });
}

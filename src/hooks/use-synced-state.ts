"use client";

import { useState } from "react";

/**
 * Local state that resets whenever the incoming prop changes — e.g. optimistic
 * UI that must follow fresh server data. Uses React's "adjust state during
 * render" pattern instead of a setState-in-effect round trip.
 */
export function useSyncedState<T>(value: T) {
  const [state, setState] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (!Object.is(previous, value)) {
    setPrevious(value);
    setState(value);
  }
  return [state, setState] as const;
}

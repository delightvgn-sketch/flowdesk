import type { LabelColor } from "./constants";

/** Static class names per label colour so Tailwind can see them. */
export const LABEL_CLASSES: Record<LabelColor, string> = {
  slate: "bg-[oklch(0.94_0.008_250)] text-[oklch(0.4_0.02_250)] dark:bg-[oklch(0.3_0.015_250)] dark:text-[oklch(0.85_0.02_250)]",
  blue: "bg-[oklch(0.94_0.03_250)] text-[oklch(0.42_0.12_255)] dark:bg-[oklch(0.3_0.05_255)] dark:text-[oklch(0.85_0.07_255)]",
  green: "bg-[oklch(0.94_0.04_150)] text-[oklch(0.42_0.1_150)] dark:bg-[oklch(0.3_0.05_150)] dark:text-[oklch(0.85_0.08_150)]",
  amber: "bg-[oklch(0.95_0.05_85)] text-[oklch(0.45_0.1_65)] dark:bg-[oklch(0.32_0.05_75)] dark:text-[oklch(0.88_0.09_80)]",
  red: "bg-[oklch(0.94_0.03_25)] text-[oklch(0.48_0.15_25)] dark:bg-[oklch(0.3_0.06_25)] dark:text-[oklch(0.85_0.08_25)]",
  violet: "bg-[oklch(0.94_0.03_300)] text-[oklch(0.45_0.13_300)] dark:bg-[oklch(0.3_0.06_300)] dark:text-[oklch(0.86_0.07_300)]",
  teal: "bg-[oklch(0.94_0.03_185)] text-[oklch(0.42_0.08_185)] dark:bg-[oklch(0.3_0.04_185)] dark:text-[oklch(0.85_0.07_185)]",
  pink: "bg-[oklch(0.94_0.03_350)] text-[oklch(0.48_0.13_350)] dark:bg-[oklch(0.3_0.06_350)] dark:text-[oklch(0.86_0.07_350)]",
};

export function labelClass(color: string) {
  return LABEL_CLASSES[color as LabelColor] ?? LABEL_CLASSES.slate;
}

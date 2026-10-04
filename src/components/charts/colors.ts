/**
 * Categorical chart colours in fixed order (validated for colour-vision
 * deficiency and contrast in both themes — see globals.css). Kept out of the
 * client chart modules so Server Components can import plain strings.
 */
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;

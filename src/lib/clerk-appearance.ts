/** Aligns Clerk's hosted components with the FlowDesk design tokens. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1f6f68",
    colorBackground: "var(--card)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorInput: "var(--card)",
    colorInputForeground: "var(--foreground)",
    colorNeutral: "var(--foreground)",
    colorBorder: "var(--border)",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-geist-sans)",
  },
  elements: {
    card: { boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" },
    footer: { background: "var(--muted)" },
  },
};

// Per-edition colour themes. The core palette object `G` is mutable module state that every
// inline style reads at render time, so switching edition (which remounts the shell) re-skins the app.
import { G } from "../apt/AptCrm.jsx";

const BASE = { mid: "#0E9F6E", light: "#34D399", gold: "#F59E0B", amber: "#E07B00", red: "#DC2626", pink: "#FEE2E2", blue: "#2563EB", sky: "#DBEAFE", purple: "#7C3AED", white: "#FFFFFF", card: "#FFFFFF", ink: "#0F172A", muted: "#64748B" };

export const THEMES = {
  distribution: { dark: "#15803D", sidebar: "#052E16", sidebar2: "#14532D", accent: "#84CC16", pale: "#ECFDF5", border: "#BBF7D0", bg: "#F3FBF5", glow: "#4ADE80" },
  importer:     { dark: "#1D4ED8", sidebar: "#0B1A4A", sidebar2: "#1E3A8A", accent: "#38BDF8", pale: "#EFF6FF", border: "#BFDBFE", bg: "#F3F7FF", glow: "#60A5FA" },
  retail:       { dark: "#EA580C", sidebar: "#431407", sidebar2: "#9A3412", accent: "#FACC15", pale: "#FFF7ED", border: "#FED7AA", bg: "#FFF9F3", glow: "#FB923C" },
  wholesale:    { dark: "#6D28D9", sidebar: "#2E1065", sidebar2: "#5B21B6", accent: "#F472B6", pale: "#F5F3FF", border: "#DDD6FE", bg: "#F8F6FF", glow: "#A78BFA" },
  services:     { dark: "#0F766E", sidebar: "#042F2E", sidebar2: "#115E59", accent: "#2DD4BF", pale: "#F0FDFA", border: "#99F6E4", bg: "#F2FBFA", glow: "#5EEAD4" },
  manufacturing:{ dark: "#B91C1C", sidebar: "#450A0A", sidebar2: "#991B1B", accent: "#FB923C", pale: "#FEF2F2", border: "#FECACA", bg: "#FFF6F6", glow: "#F87171" },
};

export function applyTheme(key) {
  const t = THEMES[key] || THEMES.distribution;
  Object.assign(G, BASE, t);
  if (typeof document !== "undefined") {
    const r = document.documentElement.style;
    r.setProperty("--td-dark", t.dark); r.setProperty("--td-accent", t.accent); r.setProperty("--td-glow", t.glow);
    r.setProperty("--td-pale", t.pale); r.setProperty("--td-border", t.border); r.setProperty("--td-bg", t.bg);
    r.setProperty("--td-sidebar", t.sidebar); r.setProperty("--td-sidebar2", t.sidebar2);
  }
  return t;
}
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

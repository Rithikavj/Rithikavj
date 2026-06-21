// DineIQ design tokens — premium dark + teal/mint
export const colors = {
  // backgrounds
  bg: "#0B0F19",
  bgPaper: "#131C2D",
  bgCard: "#1E293B",
  bgElevated: "#273449",
  bgInput: "#0F1726",

  // primary teal/mint
  primary: "#19E0B7",
  primaryLight: "#4DF0CD",
  primaryDark: "#0FA888",
  primaryContrast: "#042F26",
  primaryAlpha10: "rgba(25, 224, 183, 0.12)",
  primaryAlpha20: "rgba(25, 224, 183, 0.22)",

  // text
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  textDisabled: "#475569",

  // borders
  border: "#334155",
  borderSoft: "#1E293B",

  // status
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // wait time pills
  waitShort: "#10B981",
  waitMedium: "#F59E0B",
  waitLong: "#EF4444",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 44,
};

export const waitColor = (m: number) => {
  if (m <= 15) return colors.waitShort;
  if (m <= 30) return colors.waitMedium;
  return colors.waitLong;
};

export const waitLabel = (m: number) => {
  if (m <= 10) return "Very Short Wait";
  if (m <= 20) return "Short Wait";
  if (m <= 40) return "Moderate Wait";
  return "Long Wait";
};

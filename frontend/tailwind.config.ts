import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

/**
 * Design tokens. The palette is closed on purpose: teal for brand and action,
 * slate for structure, and red / amber / blue / green only when they carry meaning.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#FFFFFF",
      black: "#000000",
      slate: colors.slate,
      primary: {
        50: "#F0FDFA",
        100: "#CCFBF1",
        200: "#99F6E4",
        300: "#5EEAD4",
        600: "#0D9488",
        700: "#0F766E",
        800: "#115E59",
        900: "#134E4A",
      },
      danger: colors.red,
      warning: colors.amber,
      info: colors.blue,
      success: colors.green,
    },
    fontFamily: {
      sans: ["Inter", "Noto Sans Devanagari", "system-ui", "sans-serif"],
      devanagari: ["Noto Sans Devanagari", "Inter", "system-ui", "sans-serif"],
    },
    fontSize: {
      xs: ["12px", "16px"],
      sm: ["14px", "20px"],
      base: ["16px", "24px"],
      lg: ["20px", "28px"],
      xl: ["24px", "32px"],
      "2xl": ["32px", "40px"],
    },
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      md: "6px",
      lg: "8px",
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      overlay: "0 8px 24px rgba(15, 23, 42, 0.12)",
    },
    extend: {
      transitionDuration: { DEFAULT: "150ms", 200: "200ms" },
      maxWidth: { citizen: "480px" },
      minHeight: { tap: "48px" },
      minWidth: { tap: "48px" },
      keyframes: {
        "slide-in": { from: { transform: "translateX(24px)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "slide-in": "slide-in 200ms ease-out",
        "fade-in": "fade-in 180ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;

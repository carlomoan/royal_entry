import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // RoyalEntry brand: navy + gold
        navy: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#1e3a5f",
          600: "#162e4d",
          700: "#0f2236",
          800: "#091829",
          900: "#040d18",
        },
        gold: {
          50: "#fffbeb",
          100: "#fef3c7",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#c9a84c",
          600: "#b7941e",
          700: "#92700f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

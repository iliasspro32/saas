import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        cloud: "#f8fafc",
        brand: {
          50: "#eff6ff",
          500: "#2563eb",
          600: "#1d4ed8",
          900: "#172554"
        },
        mint: "#14b8a6",
        coral: "#fb7185",
        gold: "#f59e0b"
      },
      boxShadow: {
        soft: "0 24px 80px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;

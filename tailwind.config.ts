import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0A0B0F",
          panel: "#11131A",
          elevated: "#161922",
          border: "#1F2330",
        },
        accent: {
          cyan: "#22D3EE",
          violet: "#8B5CF6",
          green: "#10B981",
          amber: "#F59E0B",
          red: "#EF4444",
        },
        text: {
          primary: "#F4F5F7",
          secondary: "#9CA3AF",
          muted: "#6B7280",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.15), 0 0 24px -4px rgba(34,211,238,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;

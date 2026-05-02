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
          base: "#06070A",
          surface: "#0B0D12",
          panel: "#0F1218",
          elevated: "#141822",
          border: "#1B2030",
          line: "#222838",
          rule: "#2A3142",
        },
        accent: {
          cyan: "#22D3EE",
          ink: "#7DD3FC",
          violet: "#A78BFA",
          green: "#34D399",
          amber: "#FBBF24",
          red: "#F87171",
          rose: "#FB7185",
        },
        text: {
          primary: "#E6E8EE",
          secondary: "#9AA3B2",
          muted: "#5A6478",
          faint: "#3A4154",
        },
        sig: {
          up: "#34D399",
          down: "#F87171",
          neutral: "#7DD3FC",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
        ],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.08em" }],
      },
      letterSpacing: {
        terminal: "0.18em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.18), 0 0 30px -8px rgba(34,211,238,0.35)",
        panel:
          "inset 0 1px 0 rgba(255,255,255,0.02), 0 1px 0 rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "scan-grid":
          "linear-gradient(rgba(125,211,252,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.04) 1px, transparent 1px)",
        "panel-gradient":
          "linear-gradient(180deg, rgba(125,211,252,0.04) 0%, rgba(125,211,252,0) 60%)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
      },
      animation: {
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        ticker: "ticker 60s linear infinite",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

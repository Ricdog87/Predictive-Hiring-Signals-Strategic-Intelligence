import type { Config } from "tailwindcss";

/**
 * Hiring Radar · Light Premium Theme.
 *
 * Color palette taken 1:1 from the warm-cream Hiring Signals Desk
 * reference screenshot. Token names are kept (`bg.base`, `accent.cyan`,
 * `text.primary` …) so every existing component re-themes automatically
 * — no JSX changes are needed for the dark→light flip.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces — warm cream / sand palette.
        bg: {
          base: "#ECE4D2",      // page background
          surface: "#F2EBDB",   // sidebar, header, banner strip
          panel: "#F8F2E5",     // primary card
          elevated: "#FBF6EB",  // hover / elevated card
          border: "#D8CDB5",    // visible card border
          line: "#E5DCC4",      // subtle divider
          rule: "#EEE6D2",      // very faint rule
        },
        // Accents — preserved Bloomberg/RSG palette, darkened so that
        // numbers, badges and trend arrows hold contrast on the warm
        // light background while keeping the same visual language.
        accent: {
          cyan: "#0E6B85",      // primary RSG petrol/teal
          ink: "#1F7E96",       // softer ink-blue
          violet: "#6D4FC4",
          green: "#3A8841",
          amber: "#B07C12",
          red: "#BE3C3C",
          rose: "#C84F60",
        },
        text: {
          primary: "#1B1610",   // warm near-black, body + numbers
          secondary: "#5C5547", // warm mid-gray
          muted: "#8E867A",     // labels / eyebrows
          faint: "#B5AC9C",     // fainter hints
        },
        sig: {
          up: "#3A8841",
          down: "#BE3C3C",
          neutral: "#1F7E96",
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
        glow: "0 0 0 1px rgba(14,107,133,0.18), 0 0 30px -8px rgba(14,107,133,0.30)",
        panel:
          "0 1px 0 rgba(0,0,0,0.03), 0 1px 2px rgba(31,28,18,0.04)",
      },
      backgroundImage: {
        "scan-grid":
          "linear-gradient(rgba(31,28,18,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(31,28,18,0.04) 1px, transparent 1px)",
        "panel-gradient":
          "linear-gradient(180deg, rgba(14,107,133,0.04) 0%, rgba(14,107,133,0) 60%)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
      },
      animation: {
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        ticker: "ticker 60s linear infinite",
        "slide-down": "slideDown 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fadeIn 600ms ease-out both",
        "fade-in-up": "fadeInUp 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "boot-fill": "bootFill 1400ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scan-sweep": "scanSweep 2.6s ease-in-out infinite",
        "cursor-blink": "cursorBlink 1.05s steps(2, end) infinite",
        "pulse-pop": "pulsePop 1.6s ease-out 1",
        "highlight-fade": "highlightFade 3.2s ease-out 1",
        "shimmer-slide": "shimmerSlide 1.8s ease-in-out infinite",
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
        slideDown: {
          "0%": { transform: "translateY(-12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        bootFill: {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
        scanSweep: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "20%": { opacity: "0.6" },
          "100%": { transform: "translateX(220%)", opacity: "0" },
        },
        cursorBlink: {
          "0%, 100%": { opacity: "0" },
          "50%": { opacity: "1" },
        },
        pulsePop: {
          "0%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(14,107,133,0.45)",
          },
          "30%": {
            transform: "scale(1.015)",
            boxShadow: "0 0 0 8px rgba(14,107,133,0.10)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 14px rgba(14,107,133,0)",
          },
        },
        highlightFade: {
          "0%": { backgroundColor: "rgba(14,107,133,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        shimmerSlide: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

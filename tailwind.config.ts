import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        alife: {
          bg: "#050709",
          surface: "#0a0d12",
          card: "#0d1117",
          accent: "#00ffaa",
          "accent-dim": "#00cc88",
          blue: "#4d9fff",
          yellow: "#ffd000",
          red: "#ff3355",
          text: "#d0dce6",
          dim: "#5a6a78",
          muted: "#2a3640",
          border: "rgba(0,255,170,0.07)",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
        display: ["'Space Mono'", "'JetBrains Mono'", "monospace"],
      },
      animation: {
        "spin-slow": "spin 2s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,255,170,0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(0,255,170,0.2)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

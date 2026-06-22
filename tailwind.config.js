/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep charcoal instrument-cluster surface — intentionally NOT pure black.
        ink: {
          900: "#080A0C", // app backdrop
          850: "#0B0E11",
          800: "#0F1318", // panels
          750: "#141922",
          700: "#1A202A", // raised panel
          600: "#222A35", // borders
          500: "#2C3543",
        },
        // The one confident accent: electric cyan-green. Use with restraint.
        accent: {
          DEFAULT: "#3DF5C4",
          soft: "#2BD3A8",
          dim: "#1B7D66",
          glow: "rgba(61, 245, 196, 0.55)",
        },
        warn: "#FFB020", // reserved for bufferbloat severity only
        bad: "#FF5C5C",
        fg: {
          DEFAULT: "#E7ECF1",
          dim: "#9AA4B2",
          faint: "#5E6A7A",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,245,196,0.20), 0 0 28px -6px rgba(61,245,196,0.45)",
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 18px 40px -24px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        "sweep": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "rise": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.4s ease-in-out infinite",
        sweep: "sweep 1.6s ease-in-out infinite",
        rise: "rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */

// Every color resolves to a CSS custom property defined in src/index.css, so a
// single [data-theme] / prefers-color-scheme switch repaints the whole app
// between the light "aluminum" chassis and the "night rack" dark palette.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        chassis: "var(--chassis)", // page ground
        panel: "var(--panel)", // module faces
        ink: {
          DEFAULT: "var(--ink)",
          60: "var(--ink-60)",
          40: "var(--ink-40)",
          30: "var(--ink-30)",
        },
        signal: {
          DEFAULT: "var(--signal)",
          deep: "var(--signal-deep)",
          ink: "var(--signal-ink)",
          wash: "var(--signal-wash)",
          line: "var(--signal-line)",
        },
        line: {
          DEFAULT: "var(--line)",
          soft: "var(--line-soft)",
          ctl: "var(--line-ctl)",
        },
        seat: "var(--surface-seat)",
        "meter-green": "var(--meter-green)",
        "meter-amber": "var(--meter-amber)",
        "clip-red": "var(--clip-red)",
        "clip-text": "var(--clip-text)",
        "success-ink": "var(--success-ink)",
      },
      fontFamily: {
        sans: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        ctrl: "var(--r-ctrl)",
        mod: "var(--r-mod)",
      },
      letterSpacing: {
        eng: "0.08em",
      },
      transitionTimingFunction: {
        snap: "var(--ease-snap)",
        mech: "var(--ease-mech)",
      },
      keyframes: {
        "card-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        flick: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0.5" },
        },
      },
      animation: {
        "card-in": "card-in 0.4s var(--ease-mech) both",
        flick: "flick 0.2s steps(2, end) infinite",
      },
    },
  },
  plugins: [],
};

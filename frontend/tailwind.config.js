/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdbff",
          300: "#8ec4ff",
          400: "#59a3ff",
          500: "#3380fc",
          600: "#1d60f1",
          700: "#154bde",
          800: "#183eb4",
          900: "#19398d",
          950: "#142456",
        },
        surface: {
          light: "#eef1f8",
          dark: "#05060f",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        // Spatial depth: inset top highlight + close shadow + far ambient shadow
        spatial:
          "inset 0 1px 0 0 rgba(255,255,255,0.22), 0 2px 6px -2px rgba(8,15,40,0.16), 0 18px 40px -12px rgba(8,15,40,0.28)",
        "spatial-lg":
          "inset 0 1px 0 0 rgba(255,255,255,0.28), 0 8px 20px -6px rgba(8,15,40,0.22), 0 32px 64px -16px rgba(8,15,40,0.40)",
        "spatial-dark":
          "inset 0 1px 0 0 rgba(255,255,255,0.10), 0 2px 6px -2px rgba(0,0,0,0.5), 0 24px 50px -12px rgba(0,0,0,0.65)",
        "spatial-dark-lg":
          "inset 0 1px 0 0 rgba(255,255,255,0.14), 0 10px 24px -6px rgba(0,0,0,0.55), 0 40px 80px -16px rgba(0,0,0,0.8)",
        "glow-brand": "0 0 0 1px rgba(51,128,252,0.35), 0 0 40px -4px rgba(51,128,252,0.45)",
      },
      backdropBlur: {
        xs: "2px",
        "3xl": "40px",
        "4xl": "64px",
      },
      keyframes: {
        aurora: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(4%, -6%, 0) scale(1.15)" },
          "66%": { transform: "translate3d(-5%, 4%, 0) scale(0.92)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.85" },
        },
      },
      animation: {
        "aurora-slow": "aurora 26s ease-in-out infinite",
        "aurora-slower": "aurora 38s ease-in-out infinite",
        floaty: "floaty 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

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
          950: "#142456"
        },
        surface: {
          light: "#f6f8fb",
          dark: "#0b1020"
        }
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glass: "0 8px 32px rgba(2, 12, 40, 0.12)",
        "glass-dark": "0 8px 32px rgba(0, 0, 0, 0.45)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};

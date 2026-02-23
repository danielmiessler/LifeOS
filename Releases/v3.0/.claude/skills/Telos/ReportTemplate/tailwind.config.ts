import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Theme - Super Dark Blue Background
        background: {
          DEFAULT: "#0B0D14",
          secondary: "#12141D",
          tertiary: "#191C26",
          elevated: "#20232E",
        },

        // Text - Light on Dark
        foreground: "#F5F5F7",
        muted: {
          DEFAULT: "#A1A1A6",
          dark: "#6B6B70",
        },

        // Borders
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.12)",
          subtle: "rgba(255, 255, 255, 0.08)",
          emphasis: "rgba(255, 255, 255, 0.2)",
        },

        // Accents - Brightened for dark mode
        primary: {
          DEFAULT: "#4A9EF7",
          glow: "rgba(74, 158, 247, 0.3)",
        },
        accent: {
          DEFAULT: "#B47AFF",
          glow: "rgba(180, 122, 255, 0.3)",
        },
        success: "#4ADE80",
        warning: "#FBBF24",
        destructive: "#F87171",

        // Section backgrounds
        section: "#12141D",
        callout: "rgba(74, 158, 247, 0.1)",
      },
      fontFamily: {
        // Matthew Butterick's Practical Typography fonts
        display: ["'Advocate Wide'", "'Advocate'", "sans-serif"],
        heading: ["'Concourse Medium'", "'Concourse'", "sans-serif"],
        body: ["'Valkyrie'", "Georgia", "serif"],
        accent: ["'Heliotrope Caps'", "'Heliotrope'", "sans-serif"],
        sans: ["'Concourse'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(74, 158, 247, 0.3)",
        "glow-accent": "0 0 20px rgba(180, 122, 255, 0.3)",
      },
    },
  },
  plugins: [],
}
export default config

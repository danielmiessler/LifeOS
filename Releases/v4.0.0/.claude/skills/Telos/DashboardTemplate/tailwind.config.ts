import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#1a1b26",
        primary: "#2e7de9",
        accent: "#9854f1",
        destructive: "#f52a65",
        success: "#33b579",
        warning: "#f0a020",
      },
    },
  },
  plugins: [],
}
export default config

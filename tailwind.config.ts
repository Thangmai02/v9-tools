import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        pine: {
          DEFAULT: "rgb(var(--pine) / <alpha-value>)",
          dark: "rgb(var(--pine-dark) / <alpha-value>)",
        },
        moss: {
          DEFAULT: "rgb(var(--moss) / <alpha-value>)",
          dark: "rgb(var(--moss-dark) / <alpha-value>)",
        },
        amber: "rgb(var(--amber) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;

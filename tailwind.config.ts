import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        linho: "#FAF7F2",
        areia: "#F2ECE1",
        borda: "#E2D9C8",
        musgo: "#4A4F3B",
        oliva: "#767A65",
        terracota: {
          DEFAULT: "#A3522B",
          hover: "#88411F",
        },
        argila: "#C89D7C",
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Cormorant Garamond", "Georgia", "serif"],
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "Montserrat", "sans-serif"],
        fredoka: ["var(--font-fredoka)", "Fredoka", "sans-serif"],
        montserrat: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
        pacifico: ["var(--font-pacifico)", "Pacifico", "cursive"],
      },
      boxShadow: {
        atelier: "0 10px 30px -10px rgba(74, 79, 59, 0.08)",
        "atelier-lg": "0 20px 40px -15px rgba(74, 79, 59, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;

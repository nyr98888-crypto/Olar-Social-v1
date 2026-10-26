import type { Config } from "tailwindcss";

/**
 * Tailwind v4 uses CSS-first config (@import "tailwindcss" in globals.css).
 * This file documents content paths for tooling / IDE; PostCSS plugin reads @source.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;

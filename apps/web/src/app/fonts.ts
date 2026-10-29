import { Inter, Tektur } from "next/font/google";

// docs/DESIGN.md section 3.1. Cyrillic is loaded for future languages.
export const fontDisplay = Tektur({
  subsets: ["latin", "cyrillic"],
  axes: ["wdth"],
  variable: "--font-tektur",
  display: "swap",
});

export const fontBody = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

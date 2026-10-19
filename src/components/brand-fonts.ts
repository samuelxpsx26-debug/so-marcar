import { Archivo_Black, Barlow_Condensed, Cormorant_Garamond, Manrope, Playfair_Display } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["900"], variable: "--font-playfair", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["600"], style: ["italic"], variable: "--font-cormorant", display: "swap" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-archivo-black", display: "swap" });
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["800"], style: ["italic"], variable: "--font-barlow", display: "swap" });

export const brandFonts = [manrope, playfair, cormorant, archivoBlack, barlow].map((f) => f.variable).join(" ");

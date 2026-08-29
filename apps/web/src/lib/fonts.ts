import { Oswald, Barlow } from "next/font/google";

/**
 * Two families, both self-hosted by next/font (no external requests, no
 * layout shift):
 *
 *   Oswald  -- condensed and heavy. Carries headings and navigation, the
 *              band-poster voice. The Short Fuse logo itself supplies the
 *              genuinely extreme typography, so this only has to rhyme with
 *              it, not compete.
 *   Barlow  -- functional UI. Prices, size selectors, forms, checkout. The
 *              seed spec is explicit that these must never be illegible.
 */

export const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

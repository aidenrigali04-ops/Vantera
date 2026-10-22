import { Plus_Jakarta_Sans } from "next/font/google";

/**
 * The marketing pages' typeface (homepage, pricing, everything in MarketingShell):
 * Plus Jakarta Sans, a geometric-humanist sans that holds up at display sizes with
 * tight tracking and stays easy to read at 13px. Loaded here rather than in the
 * root layout so app routes never download it. A marketing root puts
 * `landingFont.variable` beside its `landing` class; globals.css then points the
 * landing's type at it (auth and onboarding share `.landing` but keep Poppins).
 */
export const landingFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

import type { Metadata } from "next";
import { Montserrat, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_URL, SITE_DESCRIPTION, JsonLd, organizationLd, websiteLd } from "@/lib/seo";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Poppins powers the 2026 marketing landing (weight hierarchy: 400 body → 700
// display). Montserrat / Geist Mono stay the app + dashboard typefaces.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "#1 LinkedIn Automation Tool | Vantera",
  description: SITE_DESCRIPTION,
  applicationName: "Vantera",
  openGraph: {
    title: "#1 LinkedIn Automation Tool",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "Vantera",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "#1 LinkedIn Automation Tool",
    description: SITE_DESCRIPTION,
  },
  // app/icon.svg → favicon; app/opengraph-image.tsx + app/twitter-image.tsx → the social card.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Site-wide entity graph for Google + AI engines. */}
        <JsonLd data={[organizationLd(), websiteLd()]} />
        {/* Light-only product: the dark theme was retired. forcedTheme pins it so the
            `.dark` class is never applied and every surface renders on the light system. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

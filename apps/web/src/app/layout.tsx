import type { Metadata } from "next";
import { Montserrat, Geist_Mono, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_URL, SITE_DESCRIPTION, JsonLd, organizationLd, websiteLd } from "@/lib/seo";

// Google Analytics 4 (gtag.js) — site-wide event tracking. Loaded via next/script so it's
// injected once on every route. The CSP nonce is applied automatically by Next (proxy.ts sets the
// enforcing CSP request header); GA's endpoints are allowlisted in connect-src (lib/security/csp).
// Gated to production builds so local `pnpm dev` never pollutes the analytics property.
const GA_MEASUREMENT_ID = "G-2WC6VEZB5C";

// Microsoft Clarity — heatmaps + session recordings. Same loading rules as GA: next/script
// (nonce'd, so the inline bootstrap passes the strict-dynamic CSP) and production-only.
// Clarity's upload endpoints are allowlisted in connect-src (lib/security/csp).
const CLARITY_PROJECT_ID = "xgheo2rq8n";

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
        {/* Google Analytics (gtag.js) — every route. afterInteractive: loads early, after hydration. */}
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
            </Script>
            <Script id="microsoft-clarity" strategy="afterInteractive">
              {`(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
            </Script>
          </>
        )}
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

import type { Metadata } from "next";
import { Montserrat, Geist_Mono, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { MetaRouteTracker } from "@/components/analytics/meta-route-tracker";
import { linkedinPartnerId } from "@/lib/analytics/linkedin";
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

// Meta Pixel — conversion tracking + audience building for ad campaigns. Env-gated
// (unlike GA/Clarity's hardcoded ids) so the pixel simply never renders until the
// owner pastes the id from Meta Events Manager into Vercel. Funnel events fire
// through trackEvent (lib/analytics/clarity → meta); SPA PageViews + high-intent
// ViewContent come from MetaRouteTracker. Endpoints allowlisted in lib/security/csp.
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// LinkedIn Insight Tag — conversion tracking + retargeting + audience insights for
// LinkedIn Ads. Partner id is hardcoded like the GA/Clarity ids (single source of truth in
// lib/analytics/linkedin), env-overridable. Conversions fire through trackEvent
// (lib/analytics/clarity → linkedin). Beacon origins are allowlisted in lib/security/csp.
const LINKEDIN_PARTNER_ID = linkedinPartnerId();

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Poppins powers the 2026 marketing landing (weight hierarchy: 400 body → 800
// display; 800 is the all-caps hero headline). Montserrat / Geist Mono stay the
// app + dashboard typefaces.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "#1 LinkedIn Lead Gen — Adaptive Prospecting | Vantera",
  description: SITE_DESCRIPTION,
  applicationName: "Vantera",
  openGraph: {
    title: "#1 LinkedIn Lead Gen — Adaptive Prospecting",
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "Vantera",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "#1 LinkedIn Lead Gen — Adaptive Prospecting",
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
        {/* Google Analytics + Clarity — every route, lazyOnload so they run during idle after
            load instead of competing for the main thread in the LCP/TTI window (mobile perf). */}
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="lazyOnload"
            />
            <Script id="google-analytics" strategy="lazyOnload">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
            </Script>
            <Script id="microsoft-clarity" strategy="lazyOnload">
              {`(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
            </Script>
          </>
        )}
        {/* Meta Pixel — the official bootstrap (no-ops if lib/analytics/meta already
            stubbed fbq; fbevents.js replays any queued calls). Base PageView here;
            route-change PageViews + funnel events come from the client wrappers. */}
        {process.env.NODE_ENV === "production" && META_PIXEL_ID && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                alt=""
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              />
            </noscript>
          </>
        )}
        {/* LinkedIn Insight Tag — the official bootstrap. lazyOnload keeps it off the
            LCP/TTI window (it's retargeting/conversion, not needed for first paint);
            conversion fires come through trackEvent → lib/analytics/linkedin. */}
        {process.env.NODE_ENV === "production" && LINKEDIN_PARTNER_ID && (
          <>
            <Script id="linkedin-insight-init" strategy="lazyOnload">
              {`_linkedin_partner_id = "${LINKEDIN_PARTNER_ID}";
window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
window._linkedin_data_partner_ids.push(_linkedin_partner_id);`}
            </Script>
            <Script id="linkedin-insight" strategy="lazyOnload">
              {`(function(l) {
if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
window.lintrk.q=[]}
var s = document.getElementsByTagName("script")[0];
var b = document.createElement("script");
b.type = "text/javascript";b.async = true;
b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
s.parentNode.insertBefore(b, s);})(window.lintrk);`}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                alt=""
                src={`https://px.ads.linkedin.com/collect/?pid=${LINKEDIN_PARTNER_ID}&fmt=gif`}
              />
            </noscript>
          </>
        )}
        <MetaRouteTracker />
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

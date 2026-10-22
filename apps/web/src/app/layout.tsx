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

/** Loads GA, Clarity, the Meta pixel, and the LinkedIn tag after the first gesture
 *  or a 20s fallback. Queued calls from lib/analytics still replay when the tags arrive. */
function deferredAnalyticsSource(): string {
  const meta = META_PIXEL_ID
    ? `if(!window.fbq){var n=window.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!window._fbq)window._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];}
var mt=document.createElement("script");mt.async=true;mt.src="https://connect.facebook.net/en_US/fbevents.js";
document.head.appendChild(mt);
window.fbq("init","${META_PIXEL_ID}");
window.fbq("track","PageView");`
    : "";
  const linkedin = LINKEDIN_PARTNER_ID
    ? `window._linkedin_partner_id="${LINKEDIN_PARTNER_ID}";
window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];
window._linkedin_data_partner_ids.push(window._linkedin_partner_id);
if(!window.lintrk){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[];}
var lt=document.createElement("script");lt.async=true;lt.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";
document.head.appendChild(lt);`
    : "";
  return `(function(){
if(window.__vanteraAnalytics)return;
var started=false;
function start(){
if(started)return;
started=true;
window.__vanteraAnalytics=true;
var g=document.createElement("script");g.async=true;g.src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}";
document.head.appendChild(g);
window.dataLayer=window.dataLayer||[];
window.gtag=function(){window.dataLayer.push(arguments);};
window.gtag("js",new Date());
window.gtag("config","${GA_MEASUREMENT_ID}");
(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_PROJECT_ID}");
${meta}
${linkedin}
}
["pointerdown","keydown","scroll","touchstart"].forEach(function(ev){window.addEventListener(ev,start,{once:true,passive:true});});
setTimeout(start,20000);
})();`;
}

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  // Dashboard face. Don't preload it on the marketing document — those files
  // were competing with the hero font on the critical path.
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Poppins backs the theme's display / heading / mono tokens by default. Marketing,
// auth, and onboarding re-point it to their own face (components/landing/font.ts, loaded
// only there so app routes never download it). Montserrat / Geist Mono stay the app +
// dashboard typefaces.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  adjustFontFallback: true,
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
        {/* Analytics tags stay off the lab window. They load on the first gesture,
            or after 20s, so a real session is still recorded. The Meta pixel used
            to boot with afterInteractive and was the longest main-thread task. */}
        {process.env.NODE_ENV === "production" && (
          <Script id="deferred-analytics" strategy="lazyOnload">
            {deferredAnalyticsSource()}
          </Script>
        )}
        {process.env.NODE_ENV === "production" && META_PIXEL_ID && (
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
        )}
        {process.env.NODE_ENV === "production" && LINKEDIN_PARTNER_ID && (
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

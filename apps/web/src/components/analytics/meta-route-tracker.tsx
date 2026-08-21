"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { metaTrack } from "@/lib/analytics/meta";

// The high-intent marketing pages — a ViewContent here builds the retargeting and
// lookalike audiences ad campaigns optimize against (visited pricing but never
// signed up, viewed the demo page, opened signup and bounced).
const VIEW_CONTENT: Record<string, string> = {
  "/pricing": "pricing",
  "/demo": "demo",
  "/signup": "signup",
};

/**
 * Meta Pixel route tracking, mounted once in the root layout. The bootstrap in
 * app/layout.tsx fires the first PageView; App Router client navigations never
 * reload the page, so this fires PageView on every subsequent route change —
 * plus ViewContent whenever a high-intent page is reached. Renders nothing.
 */
export function MetaRouteTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false; // initial PageView already fired by the bootstrap snippet
    } else {
      metaTrack("PageView");
    }
    const content = VIEW_CONTENT[pathname];
    if (content) metaTrack("ViewContent", { content_name: content });
  }, [pathname]);

  return null;
}

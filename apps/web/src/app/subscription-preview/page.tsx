import { notFound } from "next/navigation";
import { PreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

/**
 * `/subscription-preview` — the design-review surface for the onboarding subscription step
 * (rule 07's UI Designer Reference). DEVELOPMENT ONLY: 404s everywhere else, so the sample
 * workspace can never reach a real visitor.
 */
export default function SubscriptionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  // A fixed "now" keeps the trial dates stable across screenshots.
  return <PreviewClient nowIso="2026-08-22T12:00:00.000Z" />;
}

import { notFound } from "next/navigation";
import { PREVIEW_STATES, type PreviewStateKey } from "./fixtures";
import { PreviewClient } from "./preview-client";

export const dynamic = "force-dynamic";

/**
 * `/today-preview` — the Today design-review surface (rule 07's UI Designer Reference).
 * DEVELOPMENT ONLY: 404s in every other environment, so it can never become a public
 * surface or leak the sample cast into production.
 */
export default async function TodayPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; tab?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { state, tab } = await searchParams;
  const key: PreviewStateKey = state && state in PREVIEW_STATES ? (state as PreviewStateKey) : "steady";
  const t = tab === "replies" || tab === "activity" ? tab : PREVIEW_STATES[key].defaultTab;
  return <PreviewClient state={key} tab={t} />;
}

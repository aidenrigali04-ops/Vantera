/**
 * Barrel for the side peek's sections — existing imports of `lead-profile/sections` keep
 * working. Each section lives in `./sections/<name>.tsx`; the persisted collapsible store in
 * `./sections/section.tsx`; shared types in `./types.ts`.
 */
export { Section, readSections, writeSection, type PeekSectionId } from "./sections/section";
export { SignalsSection, SignalsTimeline } from "./sections/signals";
export { ProspectSection, RankSection } from "./sections/rank";
export { CompanySection } from "./sections/company";
export { MessageSection } from "./sections/message";
export { FitSection } from "./sections/fit";
export { CrmSection, NotesSection } from "./sections/crm-notes";
export type { PeekPost, PeekSignal, QueuedDraft, RegenerateDraft } from "./types";

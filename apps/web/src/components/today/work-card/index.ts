/**
 * The Today work card (blueprint §6.7–§6.11) — one card, three tabs, the Engine line.
 */
export { WorkCard, type WorkCardProps } from "./work-card";
export { CardTabs, type CardTab, type TabSpec } from "./card-tabs";
export { EngineLineView } from "./engine-line-view";
export { SenderChip } from "./sender-chip";
export { ActorChip, Avatar, ClassChip, ScoreChip, SignalChip, scoreTone } from "./chips";
export { RejectReasonPicker, RowActions } from "./row-actions";
export {
  FIRST_REJECT_KEY,
  FIRST_REJECT_NOTE,
  markFirstRejectSeen,
  REJECT_REASONS,
  REJECT_REASON_ORDER,
  type RejectReason,
} from "./reject-reasons";
export { HIGHLIGHT_KEYS, nextHighlight, nextTab, rowCommand, type RowCommand } from "./keyboard";
export { MonoText, splitMono } from "./mono-text";

/**
 * The intent tag a conversation wears in the inbox list and thread header — the same
 * Interested / Booked vocabulary the landing promises. Booked (a recorded meeting) outranks
 * the last reply's classification; neutral and unclassified threads carry no tag. Pure.
 */
export type IntentTone = "positive" | "blue" | "muted" | "amber";

export function replyIntent(item: {
  booked: boolean;
  lastClassification: string | null;
}): { label: string; tone: IntentTone } | null {
  if (item.booked) return { label: "Booked", tone: "positive" };
  switch (item.lastClassification) {
    case "interested":
      return { label: "Interested", tone: "blue" };
    case "not_interested":
      return { label: "Not interested", tone: "muted" };
    case "unsubscribe":
      return { label: "Opted out", tone: "muted" };
    case "out_of_office":
      return { label: "Out of office", tone: "amber" };
    default:
      return null;
  }
}

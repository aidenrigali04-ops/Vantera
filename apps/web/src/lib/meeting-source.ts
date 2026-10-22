/** How a meeting was recorded (leads.meeting_source), in plain words. */
export function meetingSourceLabel(source: string | null | undefined): string {
  if (source === "calendar") return "booked through your scheduling link";
  if (source === "agent") return "detected from the reply";
  return "marked by you";
}

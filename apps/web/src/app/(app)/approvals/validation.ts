export const SUBJECT_MAX = 120;
export const BODY_MAX = 5000;

export type ParsedDraftEdit =
  | { ok: true; values: { sendId: string; channel: "email" | "linkedin"; subject: string | null; body: string } }
  | { ok: false; error: string };

export function parseDraftEdit(formData: FormData): ParsedDraftEdit {
  const sendId = String(formData.get("sendId") ?? "").trim();
  const channel = String(formData.get("channel") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const rawSubject = formData.get("subject");
  const subject = rawSubject ? String(rawSubject).trim() || null : null;

  if (!sendId) return { ok: false, error: "Invalid request." };
  if (channel !== "email" && channel !== "linkedin") return { ok: false, error: "Invalid request." };
  if (!body) return { ok: false, error: "The message can't be empty." };
  if (body.length > BODY_MAX) return { ok: false, error: "Keep the message under 5,000 characters." };
  if (subject && subject.length > SUBJECT_MAX) {
    return { ok: false, error: "Keep the subject under 120 characters." };
  }
  return { ok: true, values: { sendId, channel, subject, body } };
}

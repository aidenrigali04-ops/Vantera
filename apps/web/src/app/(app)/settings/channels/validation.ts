import { z } from "zod";
import type { Valid, Invalid } from "@/lib/validation";

export interface SenderAddressValues {
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal: string;
  country: string;
}

export function validateSenderAddress(
  input: Record<string, unknown>
): Valid<SenderAddressValues> | Invalid {
  const line1 = String(input.line1 ?? "").trim();
  const line2Raw = String(input.line2 ?? "").trim();
  const city = String(input.city ?? "").trim();
  const region = String(input.region ?? "").trim();
  const postal = String(input.postal ?? "").trim();
  const country = String(input.country ?? "").trim();

  if (!line1) return { ok: false, error: "Street address (line 1) is required." };
  if (!city) return { ok: false, error: "City is required." };
  if (!postal) return { ok: false, error: "Postal / ZIP code is required." };
  if (!country) return { ok: false, error: "Country is required." };

  return {
    ok: true,
    values: {
      line1,
      line2: line2Raw || null,
      city,
      region: region || null,
      postal,
      country,
    },
  };
}

/**
 * The provisioning gate: no sender address (rule 11 — every cold email must
 * carry it) and no re-provisioning once mailboxes exist (each provider call
 * creates billable domains/mailboxes; the page hides the form, this guards
 * direct POSTs and stale tabs).
 */
export function canProvision(
  senderAddress: unknown,
  existingMailboxCount: number
): Valid<true> | Invalid {
  if (!senderAddress) {
    return { ok: false, error: "Add your sender address first — every cold email must carry it." };
  }
  if (existingMailboxCount > 0) {
    return { ok: false, error: "Email sending is already set up for this workspace." };
  }
  return { ok: true, values: true };
}

// ── Zod-backed provision input validator (used by startEmailProvisioning) ────

const provisionSchema = z.object({
  domainCount: z.number().int().min(1).max(10),
  mailboxesPerDomain: z.number().int().min(1).max(5),
});

export function validateProvisionInput(input: { domainCount: number; mailboxesPerDomain: number }):
  | { ok: true }
  | { ok: false; error: string } {
  const r = provisionSchema.safeParse(input);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues[0]?.message ?? "invalid" };
}

export function validateProvisionCounts(
  domainsRaw: string,
  mailboxesRaw: string
): { domainCount: number; mailboxesPerDomain: number } {
  const parsedDomains = parseInt(domainsRaw, 10);
  const parsedMailboxes = parseInt(mailboxesRaw, 10);

  const domainCount = Number.isFinite(parsedDomains)
    ? Math.min(Math.max(parsedDomains, 1), 2)
    : 1;

  const mailboxesPerDomain = Number.isFinite(parsedMailboxes)
    ? Math.min(Math.max(parsedMailboxes, 1), 3)
    : 1;

  return { domainCount, mailboxesPerDomain };
}

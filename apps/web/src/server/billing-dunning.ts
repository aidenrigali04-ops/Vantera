import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPaymentFailedEmail } from "@vantera/transactional-email";
import { siteUrl } from "@/lib/site-url";

/**
 * R5 dunning (spec 2026-07-15): a failed renewal used to pause outreach with only an
 * in-app banner as the signal. One email per past_due spell — the stamp clears when the
 * subscription recovers, so the NEXT failure emails again. Best-effort by contract: this
 * must never make the Stripe webhook fail (it has to 200).
 */
export async function applyDunning(
  supabase: SupabaseClient,
  accountId: string,
  subscriptionStatus: string
): Promise<void> {
  try {
    if (subscriptionStatus === "past_due") {
      const { data: account } = await supabase
        .from("accounts")
        .select("lifecycle_emails_enabled, payment_failed_notified_at")
        .eq("id", accountId)
        .maybeSingle<{ lifecycle_emails_enabled: boolean; payment_failed_notified_at: string | null }>();
      if (!account || !account.lifecycle_emails_enabled || account.payment_failed_notified_at) return;

      const { data: members } = await supabase
        .from("account_members")
        .select("user_id")
        .eq("account_id", accountId)
        .in("role", ["owner", "admin"]);
      const emails = new Set<string>();
      for (const m of members ?? []) {
        const { data } = await supabase.auth.admin.getUserById(m.user_id as string);
        if (data.user?.email) emails.add(data.user.email);
      }

      let sent = 0;
      for (const to of emails) {
        try {
          await sendPaymentFailedEmail({ to, appUrl: siteUrl() });
          sent += 1;
        } catch {
          // per-recipient best-effort
        }
      }
      if (sent > 0) {
        await supabase
          .from("accounts")
          .update({ payment_failed_notified_at: new Date().toISOString() })
          .eq("id", accountId);
      }
    } else if (subscriptionStatus === "active") {
      // Recovery: clear the spell stamp so a future failure notifies again.
      await supabase
        .from("accounts")
        .update({ payment_failed_notified_at: null })
        .eq("id", accountId)
        .not("payment_failed_notified_at", "is", null);
    }
  } catch {
    // dunning is an add-on — the webhook's entitlement write already succeeded
  }
}

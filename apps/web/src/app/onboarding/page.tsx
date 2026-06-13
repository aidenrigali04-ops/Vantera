import { createClient } from "@/lib/supabase/server";
import { Wizard } from "./wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const defaultCompanyName =
    (user?.user_metadata?.company_name as string | undefined)?.trim() ?? "";
  // Onboarding is always dark (brand surface, no toggle here) — see page.tsx note.
  return (
    <div className="dark bg-background text-foreground">
      <Wizard defaultCompanyName={defaultCompanyName} />
    </div>
  );
}

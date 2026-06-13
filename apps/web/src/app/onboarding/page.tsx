import { createClient } from "@/lib/supabase/server";
import { Wizard } from "./wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const defaultCompanyName =
    (user?.user_metadata?.company_name as string | undefined)?.trim() ?? "";
  return <Wizard defaultCompanyName={defaultCompanyName} />;
}

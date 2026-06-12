import { redirect } from "next/navigation";

// campaigns are an internal execution grouping, never the primary surface (rule 08)
export default function CampaignsPage() {
  redirect("/review");
}

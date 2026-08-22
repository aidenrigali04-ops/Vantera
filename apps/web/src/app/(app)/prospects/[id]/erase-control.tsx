"use client";

import { useRouter } from "next/navigation";
import { EraseLead } from "../erase-lead";

/** Client wrapper so the GDPR erase control can navigate back to the list after erasing. */
export function EraseControl({ leadId }: { leadId: string }) {
  const router = useRouter();
  return <EraseLead leadId={leadId} onErased={() => router.push("/prospects")} />;
}

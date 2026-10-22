"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IcpEditor, type IcpEditorValue } from "@/components/icp/icp-editor";
import { confirmBuyers, regenerateBuyers, type DetailsState } from "./actions";

/** Step heading + line, for the page chrome (STEP_COPY) to render above the step. */
export const BUYERS_COPY = {
  title: "Your buyers",
  sub: "We read your site and drafted who to go after. Edit anything that's off — your agents score every prospect against this.",
} as const;

/**
 * Step 2 · Your buyers — the ICP `saveDetails` drafted from the site, made visible and
 * editable. Confirming provisions the agents on it and starts the first-prospects preview.
 */
export function BuyersStep({ value }: { value: IcpEditorValue }) {
  const [state, formAction] = useActionState<DetailsState, FormData>(confirmBuyers, {});
  const [regenError, setRegenError] = useState<string | undefined>();
  const [regenerating, startRegenerate] = useTransition();
  const router = useRouter();

  const regenerate = () =>
    startRegenerate(async () => {
      setRegenError(undefined);
      const res = await regenerateBuyers();
      if (res.error) setRegenError(res.error);
      else router.refresh();
    });

  return (
    <form action={formAction} onSubmit={() => setRegenError(undefined)}>
      {/* remount on a fresh draft so the editor re-seeds from the new value */}
      <IcpEditor
        key={JSON.stringify(value)}
        value={value}
        mode="onboarding"
        onRegenerate={regenerate}
        regenerating={regenerating}
        error={regenError ?? state.error}
      />
    </form>
  );
}

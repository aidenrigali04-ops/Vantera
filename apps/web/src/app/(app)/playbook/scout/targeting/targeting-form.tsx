"use client";

import { useActionState } from "react";
import { IcpEditor, type IcpEditorValue } from "@/components/icp/icp-editor";
import { updateScoutTargeting, type AgentActionState } from "../../actions";

/** The shared buyer-profile editor in its settings placement — no fields of its own. */
export function TargetingForm({ value }: { value: IcpEditorValue }) {
  const [state, formAction] = useActionState<AgentActionState, FormData>(updateScoutTargeting, {});
  return (
    <form action={formAction}>
      <IcpEditor mode="settings" value={value} error={state.error} />
    </form>
  );
}

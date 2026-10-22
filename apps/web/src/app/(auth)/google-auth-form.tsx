"use client";

import { useActionState } from "react";
import { FormError } from "@/components/form-error";
import { signInWithGoogle, type AuthFormState } from "./actions";
import { GoogleContinueButton } from "./auth-ui";

export function GoogleAuthForm({
  next,
  site,
  inviteToken,
}: {
  next?: string;
  site?: string;
  inviteToken?: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    async (prev, formData) => {
      const result = await signInWithGoogle(prev, formData);
      if (result.url) window.location.assign(result.url);
      return result;
    },
    {}
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      {site && <input type="hidden" name="site" value={site} />}
      {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
      <GoogleContinueButton pending={pending} />
      <FormError message={state.error} />
    </form>
  );
}

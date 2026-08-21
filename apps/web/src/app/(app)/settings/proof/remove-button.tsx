"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { removeProofPoint } from "./actions";

/** T5: removing a citable fact confirms (R2 idiom) and reports failure instead of a silent no-op. */
export function RemoveProofButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);

  const remove = () => {
    setBusy(true);
    const fd = new FormData();
    fd.set("id", id);
    removeProofPoint(fd)
      .then((res) => {
        if (res.error) toast.error(res.error);
      })
      .finally(() => setBusy(false));
  };

  return (
    <ConfirmDialog
      title="Remove this proof point?"
      description="Your agent stops citing it immediately. This can't be undone."
      confirmLabel="Remove"
      destructive
      onConfirm={remove}
      trigger={(open) => (
        <Button
          type="button"
          onClick={open}
          variant="ghost"
          size="sm"
          disabled={busy}
          className="text-muted-foreground"
        >
          {busy ? "Removing…" : "Remove"}
        </Button>
      )}
    />
  );
}

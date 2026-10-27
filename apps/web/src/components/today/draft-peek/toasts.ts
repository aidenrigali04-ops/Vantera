import { toast } from "sonner";

/** The 5s toast with Undo every queue removal carries (approve / reject). */
export function undoToast(message: string, onUndo: () => void): void {
  toast(message, { duration: 5000, action: { label: "Undo", onClick: onUndo } });
}

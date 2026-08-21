import type { Tool } from "./registry";

/**
 * Pure input validation for the free tools — shared by the API route and covered by
 * colocated tests (rule 13: validation = pure functions with colocated tests). No I/O,
 * no session; these are public, unauthenticated tools.
 */

/** Absolute ceiling on total submitted characters — a token-burn / abuse backstop. */
export const TOTAL_INPUT_CAP = 9000;

export interface ValidationOk {
  ok: true;
  /** trimmed, whitelisted values keyed by field name */
  values: Record<string, string>;
}
export interface ValidationErr {
  ok: false;
  error: string;
}
export type ValidationResult = ValidationOk | ValidationErr;

/**
 * Validate a raw request body against a tool's declared fields:
 * - only known fields are kept (unknown keys dropped)
 * - required fields must be non-empty
 * - each field is capped at its `maxLength`
 * - select fields must match a declared option
 * - total length is capped globally
 */
export function validateToolInput(tool: Tool, raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid request." };
  }
  const body = raw as Record<string, unknown>;
  const values: Record<string, string> = {};
  let total = 0;

  for (const field of tool.fields) {
    const rawValue = body[field.name];
    let value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      if (field.required) {
        return { ok: false, error: `Please fill in "${field.label}".` };
      }
      continue;
    }

    if (value.length > field.maxLength) {
      // Hard cap rather than reject — protects tokens without failing a slightly-long paste.
      value = value.slice(0, field.maxLength);
    }

    if (field.type === "select" && field.options) {
      const allowed = field.options.some((o) => o.value === value);
      if (!allowed) {
        return { ok: false, error: `Invalid choice for "${field.label}".` };
      }
    }

    total += value.length;
    values[field.name] = value;
  }

  if (total > TOTAL_INPUT_CAP) {
    return { ok: false, error: "That's a lot of text — please shorten your input and try again." };
  }
  if (total === 0) {
    return { ok: false, error: "Please fill in the form before generating." };
  }

  return { ok: true, values };
}

/** Serialize validated values into the user-prompt block sent to the model. */
export function buildUserPrompt(tool: Tool, values: Record<string, string>): string {
  const lines = tool.fields
    .filter((f) => values[f.name])
    .map((f) => `${f.label}: ${values[f.name]}`);
  return lines.join("\n");
}

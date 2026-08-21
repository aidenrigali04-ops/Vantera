"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Globe, Loader2 } from "lucide-react";
import { FormError } from "@/components/form-error";
import { CtaArrow, FIELD, SubmitButton } from "@/app/(auth)/auth-ui";
import { peekFaviconAction, saveDetails, type DetailsState } from "./actions";
import type { OnboardingPrefill } from "@/lib/auth/onboarding-context";

/**
 * Step 1 · Details — the only step with inputs. Brand name and website arrive pre-filled
 * from signup and the landing hero; the favicon appears as soon as the URL is known, so
 * the page reads as "we already looked you up" rather than "fill in this form".
 */
export function DetailsForm({ prefill }: { prefill: OnboardingPrefill }) {
  const [state, formAction, pending] = useActionState<DetailsState, FormData>(saveDetails, {});
  const [website, setWebsite] = useState(prefill.websiteUrl);
  const [favicon, setFavicon] = useState<string | null>(prefill.faviconUrl);
  const [faviconFor, setFaviconFor] = useState(prefill.websiteUrl);
  const [peeking, startPeek] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookup = (value: string) => {
    const url = value.trim();
    if (!url || url === faviconFor) return;
    startPeek(async () => {
      const res = await peekFaviconAction(url);
      setFaviconFor(url);
      setFavicon(res.faviconUrl);
    });
  };

  // A pre-filled URL without a cached favicon (fresh from the hero) looks itself up on mount.
  const initialLookup = useRef(Boolean(prefill.websiteUrl && !prefill.faviconUrl));
  useEffect(() => {
    if (!initialLookup.current) return;
    initialLookup.current = false;
    const url = prefill.websiteUrl.trim();
    startPeek(async () => {
      const res = await peekFaviconAction(url);
      setFaviconFor(url);
      setFavicon(res.faviconUrl);
    });
  }, [prefill.websiteUrl]);

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <Field label="Full name" htmlFor="fullName">
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={prefill.fullName}
          placeholder="Jane Doe"
          className={`${FIELD} w-full`}
        />
      </Field>

      <Field label="Brand name" htmlFor="brandName">
        <input
          id="brandName"
          name="brandName"
          autoComplete="organization"
          required
          defaultValue={prefill.brandName}
          placeholder="Acme"
          className={`${FIELD} w-full`}
        />
      </Field>

      <Field label="Website" htmlFor="websiteUrl">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center overflow-hidden rounded-[6px] bg-[var(--tint)]">
            {peeking ? (
              <Loader2 className="size-3.5 animate-spin text-[var(--ink-4)]" />
            ) : favicon ? (
              // plain <img>: the icon lives on the customer's domain, not ours
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={favicon}
                alt=""
                className="size-4"
                onError={() => setFavicon(null)}
              />
            ) : (
              <Globe className="size-3.5 text-[var(--ink-4)]" />
            )}
          </span>
          <input
            id="websiteUrl"
            name="websiteUrl"
            inputMode="url"
            autoComplete="url"
            required
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              if (debounce.current) clearTimeout(debounce.current);
              debounce.current = setTimeout(() => lookup(e.target.value), 700);
            }}
            onBlur={(e) => lookup(e.target.value)}
            placeholder="acme.com"
            className={`${FIELD} w-full pl-12`}
          />
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--ink-4)]">
          We read your site to learn what you sell and who buys it — that&rsquo;s how your agents know who to target.
        </p>
      </Field>

      <FormError message={state.error} />

      <SubmitButton
        pending={pending}
        idle={
          <>
            Continue
            <CtaArrow />
          </>
        }
        busy={
          <>
            <Loader2 className="size-4 animate-spin" />
            Reading your site…
          </>
        }
      />
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2.5 block text-[13.5px] font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

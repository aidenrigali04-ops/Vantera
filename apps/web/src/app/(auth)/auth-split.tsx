import Link from "next/link";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { landingFont } from "@/components/landing/font";
import { CTA_REASSURANCE } from "@/components/landing/claims";
import { AuthScene } from "./auth-scene";

/**
 * Split auth layout, after rankbox.xyz's sign-up page. LEFT: a white column, card-less —
 * the mark and wordmark top-left, the page's headline and form centred, the trial
 * reassurance at the foot. RIGHT (lg+): a framed picture inset 12px from the window
 * edges, the landing showcase's painted sky with warm LinkedIn replies landing over it
 * (auth-scene.tsx). The picture is one screen tall and pinned, so it stays in view while
 * the form column scrolls; below lg it hides and the column goes full width.
 *
 * `landing` joins `auth-surface` on the root so the shared --cyan* / --fb tokens resolve to
 * brand blue and the landing keyframes apply; `marketing-type` + `landingFont.variable`
 * set the page in the marketing typeface (globals.css).
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`auth-surface landing marketing-type ${landingFont.variable} relative grid min-h-screen w-full bg-white lg:grid-cols-2`}
    >
      {/* LEFT — the form column */}
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="flex w-fit shrink-0 items-center gap-2.5 text-foreground">
          <VanteraLogo className="size-6 text-[var(--fb)]" />
          <span className="text-[1.2rem] font-semibold tracking-tight">Vantera</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <p className="text-[0.78rem] text-[var(--ink-3)]">{CTA_REASSURANCE}</p>
      </div>

      {/* RIGHT — the framed picture */}
      <div className="relative hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start lg:p-3">
        <AuthScene className="h-full w-full rounded-3xl ring-1 ring-black/5" />
      </div>
    </main>
  );
}

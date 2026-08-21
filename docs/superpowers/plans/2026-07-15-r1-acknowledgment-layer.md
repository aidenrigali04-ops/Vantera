# R1 — The Acknowledgment Layer (UI/UX completion spec, round 1)

> Spec: `docs/superpowers/specs/2026-07-15-uiux-completion-design.md` §R1. Goal: every
> navigation, action, and failure produces immediate, branded feedback.

## Pieces

**R1a Loading** — `ui/skeleton.tsx` primitive; `loading.tsx` for dashboard, leads, leads/[id],
inbox, meetings, review, agents (covers subroutes), settings (covers subtree). Plus: the app
shell's five sequential Supabase awaits in `(app)/layout.tsx` become concurrent
(`Promise.all`) — same data, ~1 round-trip of latency instead of five.

**R1b Feedback** — `sonner` Toaster mounted in the app shell (top-right; bottom-right is the
copilot pill's corner). Review actions (approve/decline/suppress/fix/save/bulk) move from
silent `useActionState` to a `useTransition` runner that toasts success and error — the card
vanishing is no longer the only signal. Checkout return: billing reads `checkout=success|cancel`;
success renders a confirmation panel (with a webhook-race "activating…" variant when
entitlement hasn't landed yet), cancel renders an acknowledgment. Settings/channels keep their
existing inline/banner feedback (already adequate).

**R1c Errors** — branded `global-error.tsx`, `(app)/error.tsx` (retry via `reset()`),
`not-found.tsx`. New `lib/supabase/guard.ts` `orThrow()` — load-bearing reads on dashboard,
leads, inbox (lib/conversations), review, meetings destructure `error` and throw instead of
rendering fake zeros; the route error boundary shows retry. The shell's own queries stay
non-fatal (nav badges degrade, never crash the frame).

**R1d Inbox optimistic echo** — `lib/conversation-merge.ts` `mergePendingTurns()` (pure,
tested): pending sends render as your bubble marked "Sending…", deduped once the server
thread includes the text. `components/conversation-panel.tsx` client wrapper (thread +
composer + pending state, layout preserved via className props) replaces the raw pair on
/inbox and the lead page. `Composer` gains `onQueued(text)`.

## Verification
Full gate; `guard.test.ts` + `conversation-merge.test.ts` new; manual: skeleton on nav,
approve toast, thread echo, branded 404/error, checkout banners. Help-content: `inbox.md`
notes the immediate echo.

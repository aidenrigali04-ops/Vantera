# Vantera Architecture

- **monorepo:** Turborepo + pnpm workspaces
- **frontend:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, shadcn/ui
- **database:** Drizzle ORM + Supabase Postgres (`@vantera/db`)
- **auth:** Supabase Auth — two session types:
  - admin: `userId + accountId + role` → `v_admin_session` cookie
  - portal: `contactId + accountId` → `v_portal_session` cookie
- **jobs:** Trigger.dev (`@trigger.dev/sdk`)
- **email:** Resend + React Email (`@react-email/components`)
- **sms:** Twilio
- **payments:** Stripe (`stripe` + `@stripe/stripe-js`)
- **ai:** Claude via Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)

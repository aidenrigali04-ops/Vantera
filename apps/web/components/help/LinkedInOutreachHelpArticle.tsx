import { Button } from '@/components/ui/button'
import Link from 'next/link'

type Props = {
  appOrigin: string
}

export function LinkedInOutreachHelpArticle({ appOrigin }: Props) {
  return (
    <article className="space-y-8 text-[13px] leading-relaxed text-[var(--text-secondary)]">
      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">What you need</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Google Chrome with the Vantera LinkedIn add-on installed</li>
          <li>You logged into LinkedIn in that same Chrome profile</li>
          <li>Access to Vantera (Outreach → LinkedIn and Outreach → Agents)</li>
        </ul>
        <p>
          LinkedIn messages are always sent by you on LinkedIn. Vantera drafts notes, queues who to
          contact next, and tracks what you have sent. Email still sends automatically from Vantera.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Part 1 — Connect Vantera to LinkedIn (one time)
        </h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <span className="font-medium text-[var(--text-primary)]">Open the LinkedIn hub.</span>{' '}
            In Vantera, go to{' '}
            <Link href="/admin/outreach/linkedin" className="font-medium text-[var(--accent)] hover:underline">
              Outreach → LinkedIn
            </Link>
            .
          </li>
          <li>
            <span className="font-medium text-[var(--text-primary)]">Set up the Chrome add-on.</span>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Click <strong>Set up LinkedIn add-on</strong>.</li>
              <li>
                Click <strong>Get connection code</strong> and copy the code right away (it is only
                shown once).
              </li>
              <li>
                In Chrome, open <strong>Extensions</strong> and install the Vantera LinkedIn add-on
                (your workspace admin can share install steps if you need them).
              </li>
              <li>Open the add-on from the Chrome toolbar.</li>
              <li>
                Paste your <strong>Vantera web address</strong> — the same link you use to sign in.
                {appOrigin ? (
                  <>
                    {' '}
                    For this workspace:{' '}
                    <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[12px] text-[var(--text-primary)]">
                      {appOrigin}
                    </code>
                  </>
                ) : null}
              </li>
              <li>Paste your <strong>connection code</strong> and click save.</li>
            </ul>
          </li>
          <li>
            When it works, the LinkedIn hub shows <strong>LinkedIn add-on: Connected</strong>.
          </li>
        </ol>
        <Button size="sm" className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]" asChild>
          <Link href="/admin/outreach/linkedin">Open LinkedIn hub</Link>
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Part 2 — Add prospects with LinkedIn profiles
        </h2>
        <p>
          Each person you want to reach needs a <strong>LinkedIn profile link</strong> on their
          contact in Vantera. Add links from your CRM, Prospect Scout, imports, or by editing a
          contact manually.
        </p>
        <p>
          The setup progress bar on the LinkedIn hub updates when you have leads with LinkedIn URLs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Part 3 — Write notes and launch
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Create a <strong>LinkedIn campaign</strong> from the LinkedIn hub, or use an outreach
            agent sequence that includes LinkedIn steps.
          </li>
          <li>Write connection notes yourself or use an AI draft.</li>
          <li>
            <strong>Launch</strong> the campaign so people appear in{' '}
            <strong>Ready to send on LinkedIn</strong>.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Part 4 — Automatic or review before send
        </h2>
        <p>
          On{' '}
          <Link href="/admin/outreach/agents" className="font-medium text-[var(--accent)] hover:underline">
            Outreach → Agents
          </Link>
          , use one switch for how outreach runs:
        </p>
        <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              <tr>
                <th className="px-4 py-2.5 font-medium text-[var(--text-primary)]">Mode</th>
                <th className="px-4 py-2.5 font-medium text-[var(--text-primary)]">What happens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              <tr>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">Automatic</td>
                <td className="px-4 py-3">
                  Vantera queues LinkedIn steps and the add-on can open the next profile for you. You
                  still send the note on LinkedIn, then mark it done.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">Review before send</td>
                <td className="px-4 py-3">
                  You review copy in Message Drafter or the LinkedIn hub first, then send on LinkedIn
                  and mark done.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          Part 5 — Send messages (every day)
        </h2>
        <p>All of these use the same queue — pick what fits your workflow:</p>
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="font-medium text-[var(--text-primary)]">A. LinkedIn hub</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Copy the note</li>
              <li>Open the person&apos;s LinkedIn profile</li>
              <li>Send the connection note on LinkedIn</li>
              <li>Mark it done in Vantera</li>
            </ol>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="font-medium text-[var(--text-primary)]">B. Message Drafter</p>
            <p className="mt-2">
              <Link
                href="/admin/outreach/agents/drafter?tab=linkedin"
                className="font-medium text-[var(--accent)] hover:underline"
              >
                Outreach → Agents → Message Drafter
              </Link>{' '}
              → LinkedIn tab. Same steps: copy, send on LinkedIn, mark as sent.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="font-medium text-[var(--text-primary)]">C. Chrome add-on</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Click <strong>Open next person on LinkedIn</strong> (opens their profile and can paste
                your note)
              </li>
              <li>Send on LinkedIn</li>
              <li>
                Click <strong>Mark current message as sent</strong>
              </li>
            </ol>
            <p className="mt-2">The add-on shows how many messages you have sent today vs your daily limit.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Quick checklist</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Install add-on in Chrome</li>
          <li>Get connection code and paste web address + code in the add-on</li>
          <li>LinkedIn profile links on contacts</li>
          <li>Launch campaign or sequence</li>
          <li>Set Automatic or Review before send on Agents</li>
          <li>Send on LinkedIn → mark done in hub, Drafter, or add-on</li>
        </ol>
      </section>
    </article>
  )
}

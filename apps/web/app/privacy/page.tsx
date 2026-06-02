import { LegalDocumentShell, LegalSection } from '@/components/legal/legal-document-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Vantera',
  description: 'Privacy Policy for Vantera.',
}

export default function PrivacyPage() {
  return (
    <LegalDocumentShell title="Privacy Policy" updatedAt="May 25, 2026">
      <LegalSection title="Overview">
        <p>
          Vantera respects your privacy. This policy describes what information we collect, how we
          use it, and the choices you have when you use our service.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>
          We collect information you provide directly — such as your name, business name, email
          address, and workspace data you add to the platform (clients, deals, projects, and related
          records).
        </p>
        <p>
          We also collect technical information needed to operate the service, including device and
          browser data, IP address, and usage logs related to authentication and security.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <p>We use your information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, maintain, and secure your Vantera workspace</li>
          <li>Authenticate you and prevent fraud or abuse</li>
          <li>Respond to support requests and communicate about the service</li>
          <li>Improve product performance and reliability</li>
        </ul>
      </LegalSection>

      <LegalSection title="Sharing">
        <p>
          We do not sell your personal information. We share data only with service providers that
          help us operate Vantera (such as hosting and authentication), when required by law, or with
          your direction.
        </p>
      </LegalSection>

      <LegalSection title="Retention and security">
        <p>
          We retain your information for as long as your account is active or as needed to provide
          the service. We apply administrative, technical, and organizational measures designed to
          protect your data.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You may access, update, or delete workspace data within the product. You may request
          account deletion by contacting us. Some information may be retained where required for
          legal or security purposes.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Privacy questions? Contact{' '}
          <a
            href="mailto:privacy@vantera.app"
            className="font-medium text-stone-900 underline-offset-2 hover:underline"
          >
            privacy@vantera.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}

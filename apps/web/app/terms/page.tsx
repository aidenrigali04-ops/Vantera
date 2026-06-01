import { LegalDocumentShell, LegalSection } from '@/components/legal/legal-document-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Ventaro',
  description: 'Terms of Service for Ventaro.',
}

export default function TermsPage() {
  return (
    <LegalDocumentShell title="Terms of Service" updatedAt="May 25, 2026">
      <LegalSection title="Agreement">
        <p>
          By creating an account or using Ventaro, you agree to these Terms of Service. If you are
          using Ventaro on behalf of a business, you represent that you have authority to bind that
          business to these terms.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Ventaro provides a workspace for managing clients, pipeline, projects, and related
          business operations. Features may change as the product evolves. We will make reasonable
          efforts to communicate material changes that affect your use of the service.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and
          for all activity under your account. Notify us promptly if you suspect unauthorized access.
        </p>
        <p>
          You agree to provide accurate registration information and to keep your business and contact
          details up to date.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          You may not use Ventaro to violate applicable law, infringe others&apos; rights, transmit
          malware, attempt unauthorized access, or interfere with the service or other users.
        </p>
      </LegalSection>

      <LegalSection title="Data and content">
        <p>
          You retain ownership of the data you upload to Ventaro. You grant Ventaro a limited license
          to host, process, and display that data solely to provide and improve the service.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer">
        <p>
          Ventaro is provided &ldquo;as is&rdquo; without warranties of any kind, to the fullest extent
          permitted by law. We do not guarantee uninterrupted or error-free operation.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? Contact{' '}
          <a
            href="mailto:legal@ventaro.app"
            className="font-medium text-stone-900 underline-offset-2 hover:underline"
          >
            legal@ventaro.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}

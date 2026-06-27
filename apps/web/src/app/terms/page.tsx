import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS_OF_SERVICE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | Vantera",
  description:
    "The terms that govern your use of Vantera — the service, your responsibilities, account safety, billing, and acceptable use.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage doc={TERMS_OF_SERVICE} />;
}

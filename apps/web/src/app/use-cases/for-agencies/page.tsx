import { UseCasePageBody, buildUseCaseMetadata } from "@/components/landing/use-case/use-case-page";
import { AGENCIES_CONTENT } from "./content";

export const metadata = buildUseCaseMetadata(AGENCIES_CONTENT);

export default function ForAgenciesPage() {
  return <UseCasePageBody content={AGENCIES_CONTENT} />;
}

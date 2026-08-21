import { UseCasePageBody, buildUseCaseMetadata } from "@/components/landing/use-case/use-case-page";
import { FOUNDERS_CONTENT } from "./content";

export const metadata = buildUseCaseMetadata(FOUNDERS_CONTENT);

export default function ForFoundersPage() {
  return <UseCasePageBody content={FOUNDERS_CONTENT} />;
}

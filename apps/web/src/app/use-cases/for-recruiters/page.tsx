import { UseCasePageBody, buildUseCaseMetadata } from "@/components/landing/use-case/use-case-page";
import { RECRUITERS_CONTENT } from "./content";

export const metadata = buildUseCaseMetadata(RECRUITERS_CONTENT);

export default function ForRecruitersPage() {
  return <UseCasePageBody content={RECRUITERS_CONTENT} />;
}

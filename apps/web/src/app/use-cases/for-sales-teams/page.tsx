import { UseCasePageBody, buildUseCaseMetadata } from "@/components/landing/use-case/use-case-page";
import { SALES_TEAMS_CONTENT } from "./content";

export const metadata = buildUseCaseMetadata(SALES_TEAMS_CONTENT);

export default function ForSalesTeamsPage() {
  return <UseCasePageBody content={SALES_TEAMS_CONTENT} />;
}

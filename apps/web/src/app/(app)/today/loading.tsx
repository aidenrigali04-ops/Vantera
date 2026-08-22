import { TodaySkeleton } from "@/components/today";

/**
 * The loading boundary. Skeletons are sized to the final layout (blueprint §6.13) so the
 * page never shifts when the data lands — CLS 0 is the bar.
 */
export default function TodayLoading() {
  return <TodaySkeleton />;
}

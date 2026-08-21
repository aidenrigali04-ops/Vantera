import type { ComponentType } from "react";
import {
  Bolt,
  CalendarCheck,
  CheckCheck,
  Clock,
  Filter,
  Handshake,
  Inbox,
  Layers,
  LineChart,
  Radar,
  Rocket,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundSearch,
  Users,
} from "lucide-react";
import {
  ControlIcon,
  CrmSyncIcon,
  OutreachIcon,
  ProspectingIcon,
  RepliesIcon,
  SafetyIcon,
} from "@/components/landing/product-icons";

/**
 * Icon registry for use-case content — lets the plain, serializable content model
 * reference an icon by a string key (no component references crossing the RSC boundary).
 * Mixes the bespoke product-icon set (duotone, brand metaphor) with a few lucide line
 * icons for the general concepts. Consumers render `<UseCaseGlyph name=… className=… />`
 * rather than looking up a component themselves (keeps the lookup in one component body,
 * clear of hook-shaped helpers and map-callback component creation).
 */
export type UseCaseIcon = ComponentType<{ className?: string }>;

export const USE_CASE_ICONS = {
  // bespoke product concepts
  prospecting: ProspectingIcon,
  outreach: OutreachIcon,
  safety: SafetyIcon,
  replies: RepliesIcon,
  crm: CrmSyncIcon,
  control: ControlIcon,
  // lucide line icons
  search: UserRoundSearch,
  radar: Radar,
  clock: Clock,
  users: Users,
  target: Target,
  filter: Filter,
  layers: Layers,
  bolt: Bolt,
  rocket: Rocket,
  send: Send,
  check: CheckCheck,
  chart: LineChart,
  trend: TrendingUp,
  inbox: Inbox,
  calendar: CalendarCheck,
  sparkle: Sparkles,
  handshake: Handshake,
} satisfies Record<string, UseCaseIcon>;

export type UseCaseIconKey = keyof typeof USE_CASE_ICONS;

/** Renders a use-case icon by its content key. */
export function UseCaseGlyph({ name, className }: { name: UseCaseIconKey; className?: string }) {
  const Icon = USE_CASE_ICONS[name];
  return <Icon className={className} />;
}

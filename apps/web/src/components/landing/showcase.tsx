import { Band } from "./frame";
import { AppReplica } from "./app-replica";
import { PaintedStage } from "./painted-stage";
import { ProspectRows } from "./prospect-rows";

/**
 * The product, framed like a picture: the Vantera Inbox laid on the painted sky
 * (painted-stage.tsx), then rows of the prospects the agents qualify. After Rankaria's
 * showcase under its hero (their dashboard on a Van Gogh, then a strip of domains).
 * Inside, the app runs its own loop (app-replica.tsx).
 */
export function Showcase() {
  return (
    <section aria-label="The Vantera app">
      <Band inner="overflow-hidden">
        <PaintedStage>
          <AppReplica />
        </PaintedStage>
      </Band>
      <Band>
        <ProspectRows />
      </Band>
    </section>
  );
}

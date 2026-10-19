import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { setSubjectStatus } from "./actions";
import { CreateSubjectForm } from "./create-subject-form";

export const metadata = { title: "Learning" };

type SubjectRow = { id: string; name: string; status: "draft" | "live" | "paused" };

export default async function LearningPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: subject } = await supabase
    .from("agents")
    .select("id, name, status")
    .eq("kind", "optimizer")
    .maybeSingle<SubjectRow>();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col">
      <div className="mb-6 border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Learning</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Learning stays off until this account has a subject. Creating one does not change who gets contacted.
        </p>
      </div>

      {error ? (
        <p className="mb-6 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {subject ? (
        <Panel className="max-w-xl p-8">
          <p className="text-sm text-muted-foreground">{subject.status === "live" ? "On" : "Paused"}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{subject.name}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {subject.status === "live"
              ? "Outreach is unchanged. A test that would contact people differently waits in Approvals."
              : "Nothing is being learned. Outreach continues as it did before."}
          </p>
          <form className="mt-8" action={setSubjectStatus.bind(null, subject.status === "live" ? "paused" : "live")}>
            <Button type="submit" variant={subject.status === "live" ? "outline" : "default"}>
              {subject.status === "live" ? "Pause learning" : "Resume learning"}
            </Button>
          </form>
        </Panel>
      ) : (
        <Panel className="max-w-xl p-8">
          <h2 className="text-xl font-semibold tracking-tight">Create the first subject</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            You can name it yourself, or have the first one created from this workspace. Either way, learning starts here and nowhere else.
          </p>
          <div className="mt-8">
            <CreateSubjectForm />
          </div>
        </Panel>
      )}
    </div>
  );
}

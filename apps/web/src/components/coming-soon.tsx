import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({
  title,
  description,
  unlocks,
}: {
  title: string;
  description: string;
  unlocks: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <Card className="mt-6">
        <CardContent className="py-10 text-center">
          <p className="mx-auto max-w-md text-muted-foreground">{description}</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground/80">{unlocks}</p>
        </CardContent>
      </Card>
    </div>
  );
}

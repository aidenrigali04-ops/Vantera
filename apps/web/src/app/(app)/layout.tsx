import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { signOut } from "./actions";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/nav-link";
import CopilotOverlay from "@/components/copilot/copilot-overlay";
import { GlassFilter } from "@/components/ui/liquid-glass";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await getGateData();
  const dest = resolveGate("app", toGateContext(data));
  if (dest) redirect(dest);

  return (
    <div className="flex min-h-screen">
      <GlassFilter />
      <aside className="flex w-60 flex-col border-r border-border px-3 py-4">
        <div className="flex items-center justify-between px-2">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            Vantera
          </Link>
          <AnimatedThemeToggle />
        </div>
        <SidebarNav />
        <div className="border-t border-border pt-3">
          <p className="truncate px-2 text-xs text-muted-foreground">{data.user?.email}</p>
          <form action={signOut} className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              <LogOut /> Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="glass-cards flex-1 px-8 py-6">{children}</main>
      <CopilotOverlay />
    </div>
  );
}

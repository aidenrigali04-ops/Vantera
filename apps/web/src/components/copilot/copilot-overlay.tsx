"use client";
import { usePathname } from "next/navigation";
import { MorphPanel } from "./morph-panel";

export default function CopilotOverlay() {
  const pathname = usePathname();
  return <MorphPanel surface={pathname} />;
}

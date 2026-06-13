import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Frosted-glass layers replicated from the auth card (`GlassEffect` in
 * `liquid-glass.tsx`): a blurred + distorted backdrop, a translucent white
 * fill, and an inset highlight. Rendered behind card content via `-z-10`; the
 * card root sets `isolate` so in-flow content always paints above these.
 * Requires the `#glass-distortion` SVG filter mounted once per page.
 */
function CardGlass() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        style={{
          backdropFilter: "var(--glass-blur)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
        style={{ background: "var(--glass-fill)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
        style={{ boxShadow: "var(--glass-rim)" }}
      />
    </>
  )
}

function Card({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card relative isolate flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl py-(--card-spacing) text-sm text-card-foreground shadow-(--glass-shadow) ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    >
      <CardGlass />
      {children}
    </div>
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardGlass,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}

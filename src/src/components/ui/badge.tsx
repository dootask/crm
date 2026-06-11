import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "#/lib/utils.ts"
import { useOptionMeta } from "#/lib/use-options"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

// ---- CRM 业务徽章（基于 shadcn Badge + 语义色）----
import {
  OPPORTUNITY_STATUS,
  type CustomerStatus,
  type OpportunityStage,
  type OpportunityStatus,
} from "#/lib/types"

export type Tone =
  | "gray"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "cyan"

// 颜色选择器（管理页选项编辑）复用的 tone 列表。
export const TONES: ReadonlyArray<Tone> = [
  "gray",
  "blue",
  "green",
  "amber",
  "red",
  "violet",
  "cyan",
]

const toneClass: Record<Tone, string> = {
  gray: "border-transparent bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  blue: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  green:
    "border-transparent bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  amber:
    "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  red: "border-transparent bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  violet:
    "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  cyan: "border-transparent bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
}

// 实心小圆点，用于 Select 等无法承载整枚徽章的场景体现状态颜色。
const toneDotClass: Record<Tone, string> = {
  gray: "bg-zinc-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
}

export function ToneDot({
  tone = "gray",
  className,
}: {
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        toneDotClass[tone],
        className,
      )}
    />
  )
}

export function ToneBadge({
  tone = "gray",
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <Badge className={cn(toneClass[tone], className)}>{children}</Badge>
  )
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const meta = useOptionMeta("customer_status", status)
  return <ToneBadge tone={meta.tone as Tone}>{meta.label}</ToneBadge>
}

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  const meta = useOptionMeta("opportunity_stage", stage)
  return <ToneBadge tone={meta.tone as Tone}>{meta.label}</ToneBadge>
}

const oppStatusTone: Record<OpportunityStatus, Tone> = {
  open: "blue",
  won: "green",
  lost: "red",
}
export function OppStatusBadge({ status }: { status: OpportunityStatus }) {
  return (
    <ToneBadge tone={oppStatusTone[status] ?? "gray"}>
      {OPPORTUNITY_STATUS[status] ?? status}
    </ToneBadge>
  )
}

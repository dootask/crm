import { cn } from '#/lib/utils'
import {
  CUSTOMER_STATUS,
  OPPORTUNITY_STAGE,
  OPPORTUNITY_STATUS,
  type CustomerStatus,
  type OpportunityStage,
  type OpportunityStatus,
} from '#/lib/types'

export type Tone =
  | 'gray'
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'violet'
  | 'cyan'

const tones: Record<Tone, string> = {
  gray: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  violet:
    'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
}

export function Badge({
  tone = 'gray',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const customerTone: Record<CustomerStatus, Tone> = {
  lead: 'gray',
  following: 'blue',
  signed: 'green',
  lost: 'red',
}
export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return <Badge tone={customerTone[status] ?? 'gray'}>{CUSTOMER_STATUS[status] ?? status}</Badge>
}

const stageTone: Record<OpportunityStage, Tone> = {
  initial: 'gray',
  qualified: 'cyan',
  proposal: 'violet',
  negotiation: 'amber',
}
export function StageBadge({ stage }: { stage: OpportunityStage }) {
  return <Badge tone={stageTone[stage] ?? 'gray'}>{OPPORTUNITY_STAGE[stage] ?? stage}</Badge>
}

const oppStatusTone: Record<OpportunityStatus, Tone> = {
  open: 'blue',
  won: 'green',
  lost: 'red',
}
export function OppStatusBadge({ status }: { status: OpportunityStatus }) {
  return <Badge tone={oppStatusTone[status] ?? 'gray'}>{OPPORTUNITY_STATUS[status] ?? status}</Badge>
}

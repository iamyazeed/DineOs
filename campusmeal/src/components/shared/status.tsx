import { Pill, type Tone } from "@/components/ui/primitives";
import { PREP_LABEL } from "@/lib/constants";
import type { MealStatus, PrepStatus } from "@/types/domain";
import type { Prep } from "@/features/meals/queries";

const PREP_TONE: Record<PrepStatus, Tone> = { not_started: "dim", in_progress: "teal", completed: "good", delayed: "bad" };

/** Preparation status. A meal with no kitchen update is Not Started and on time. */
export function PrepPill({ prep }: { prep: Prep | null }) {
  const status = prep?.status ?? "not_started";
  return (
    <Pill tone={PREP_TONE[status]} dot>
      {PREP_LABEL[status]}
      {status === "delayed" && prep?.delay_minutes ? ` · +${prep.delay_minutes} min` : ""}
    </Pill>
  );
}

export function OnTimePill({ prep }: { prep: Prep | null }) {
  return prep?.status === "delayed" ? <Pill tone="bad">Delayed</Pill> : <Pill tone="good">On time</Pill>;
}

const MEAL_TONE: Record<MealStatus, Tone> = { scheduled: "good", modified: "teal", sponsored: "warn", cancelled: "bad" };
const MEAL_LABEL: Record<MealStatus, string> = { scheduled: "Scheduled", modified: "Menu changed", sponsored: "Sponsored", cancelled: "Cancelled" };

export function MealStatusPill({ status, compact }: { status: MealStatus; compact?: boolean }) {
  if (compact) return <span style={{ color: `var(--${MEAL_TONE[status] === "teal" ? "teal2" : MEAL_TONE[status]})` }}>{MEAL_LABEL[status]}</span>;
  return <Pill tone={MEAL_TONE[status]}>{MEAL_LABEL[status]}</Pill>;
}

const REQ_TONE: Record<string, Tone> = {
  pending: "warn",
  open: "warn",
  approved: "good",
  rejected: "bad",
  in_progress: "teal",
  resolved: "good",
  acknowledged: "teal",
  pending_delivery: "dim",
  dispatched: "teal",
  delivered: "good",
  serving: "teal",
  completed: "good",
};

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={REQ_TONE[status] ?? "dim"}>{status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Pill>;
}

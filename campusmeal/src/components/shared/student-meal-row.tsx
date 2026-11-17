import type { StudentMeal } from "@/features/cancellations/queries";
import { cancelMyMeal, undoMyCancellation } from "@/features/cancellations/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Pill } from "@/components/ui/primitives";
import { MealStatusPill } from "@/components/shared/status";
import { fmtDate, fmtTime } from "@/lib/utils";

export function MyMealStatus({ m }: { m: StudentMeal }) {
  if (m.status === "cancelled") return <MealStatusPill status="cancelled" />;
  if (m.cancelled) return <Pill tone="bad">{m.cancelled.source === "exception" ? "Cancelled (late exception)" : "You cancelled"}</Pill>;
  return <Pill tone="good">You&apos;re eating</Pill>;
}

/** One meal with the student's cancel / undo controls (deadline enforced server-side too). */
export function StudentMealRow({ m, showDate }: { m: StudentMeal; showDate?: boolean }) {
  const deadline = m.deadline.replace("T", " ");
  return (
    <div className="list-row flex-wrap items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{m.schedule.name}</span>
          <span className="mono text-[12px] text-dim">
            {showDate && `${fmtDate(m.meal_date)} · `}
            {fmtTime(m.schedule.serve_time)}
          </span>
          <MyMealStatus m={m} />
          {m.status === "sponsored" && <MealStatusPill status="sponsored" />}
        </div>
        <div className="mt-1 text-[13px] text-dim">{m.menu || "Menu not published yet"}</div>
        {m.status_reason && <div className="mt-1 text-[12px] text-amber">{m.status_reason}</div>}
        <div className="mt-1 text-[11.5px] text-faint">{m.canChange ? `Change before ${deadline}` : m.status === "cancelled" ? "" : `Deadline passed (${deadline}) — ask your teacher for a late change`}</div>
      </div>
      {m.canChange && (
        <ActionForm action={m.cancelled ? undoMyCancellation : cancelMyMeal} inline confirm={m.cancelled ? undefined : `Cancel ${m.schedule.name} on ${fmtDate(m.meal_date)}?`}>
          <input type="hidden" name="meal_id" value={m.id} />
          {m.cancelled ? (
            <SubmitButton size="sm" variant="ghost">
              I&apos;ll eat after all
            </SubmitButton>
          ) : (
            <SubmitButton size="sm" variant="danger">
              Cancel meal
            </SubmitButton>
          )}
        </ActionForm>
      )}
    </div>
  );
}

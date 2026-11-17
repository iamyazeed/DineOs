import type { DayMeal } from "@/features/meals/queries";
import { updatePreparation } from "@/features/kitchen/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, ProgressBar } from "@/components/ui/primitives";
import { OnTimePill, PrepPill } from "@/components/shared/status";
import { fmtTime } from "@/lib/utils";

/** Chef-only preparation control for one meal. */
export function PrepCard({ meal, regular, separate }: { meal: DayMeal; regular: number; separate: number }) {
  const p = meal.prep;
  if (meal.status === "cancelled") {
    return (
      <div className="glass rounded-[14px] p-4 opacity-70">
        <div className="font-semibold">{meal.schedule.name}</div>
        <p className="mt-2 text-[13px] text-bad">Cancelled{meal.status_reason ? ` — ${meal.status_reason}` : ""}. Do not prepare.</p>
      </div>
    );
  }
  return (
    <div className="glass rounded-[14px] p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{meal.schedule.name}</div>
        <span className="mono text-[12px] text-dim">{fmtTime(meal.schedule.serve_time)}</span>
      </div>
      <div className="mt-1 text-[12.5px] text-dim">
        <span className="mono text-text">{regular}</span> regular · <span className="mono text-text">{separate}</span> separate
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <PrepPill prep={p} />
        <OnTimePill prep={p} />
      </div>
      <ProgressBar value={p?.progress ?? 0} bad={p?.status === "delayed"} />
      <ActionForm action={updatePreparation} className="mt-3">
        <input type="hidden" name="meal_id" value={meal.id} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Status">
            <select name="status" defaultValue={p?.status ?? "not_started"}>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </Field>
          <Field label="Progress %">
            <input name="progress" type="number" min={0} max={100} step={5} defaultValue={p?.progress ?? 0} />
          </Field>
        </div>
        <details className="disclosure">
          <summary className="text-[12px] font-semibold text-amber">Report a delay</summary>
          <div className="mt-2 grid grid-cols-[100px_1fr] gap-2">
            <Field label="Minutes">
              <input name="delay_minutes" type="number" min={1} max={600} defaultValue={p?.delay_minutes ?? ""} />
            </Field>
            <Field label="Reason">
              <input name="delay_reason" maxLength={300} defaultValue={p?.delay_reason ?? ""} placeholder="e.g. gas supply interruption" />
            </Field>
          </div>
        </details>
        <div>
          <SubmitButton size="sm">Update</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

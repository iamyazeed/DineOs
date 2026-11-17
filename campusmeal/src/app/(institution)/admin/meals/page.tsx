import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { overrideMeal } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { MealPicker } from "@/components/shared/meal-picker";
import { MealStatusPill } from "@/components/shared/status";
import { EmptyState, Field, KV, Notice, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDate, fmtTime } from "@/lib/utils";
import type { PageProps } from "@/types/page";

export default async function DailyMeals({ searchParams }: PageProps) {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const { date, today, meals, selected } = await resolveMealSelection(ctx.supabase, inst, await searchParams);
  const b = selected ? await getMealBreakdown(ctx.supabase, inst, selected) : null;

  return (
    <>
      <PageHeader
        eyebrow="Daily operations"
        title="Daily meals & exceptions"
        sub="Every day is generated from your standing timetable. Use this page only for sponsored meals, emergency cancellations or menu changes."
      />
      <MealPicker basePath="/admin/meals" date={date} today={today} meals={meals} selectedId={selected?.id} />
      {!selected || !b ? (
        <Panel>
          <EmptyState>No meals on {fmtDate(date)}.</EmptyState>
        </Panel>
      ) : (
        <div className="cols">
          <Panel title={`${selected.schedule.name} · ${fmtDate(date)}`} sub={`Served at ${fmtTime(selected.schedule.serve_time)}`} actions={<MealStatusPill status={selected.status} />}>
            <KV k="Published menu" v={selected.menu || "—"} />
            <KV k="Cancellation deadline" v={selected.deadline.replace("T", " ")} />
            <KV k="Regular portions" v={b.regular} />
            <KV k="Separate portions" v={b.separatePortions} />
            <KV k="Not attending" v={b.excluded} />
            {selected.status_reason && (
              <div className="mt-3">
                <Notice tone={selected.status === "cancelled" ? "bad" : "warn"}>{selected.status_reason}</Notice>
              </div>
            )}
            <p className="mt-3 text-[12px] text-faint">Changing a meal never deletes it — the original record is preserved for reporting.</p>
          </Panel>
          <Panel title="Apply an exception" sub="Students, teachers and the kitchen can be notified automatically">
            <ActionForm action={overrideMeal} confirm="Apply this change to the meal?">
              <input type="hidden" name="meal_id" value={selected.id} />
              <Field label="Change">
                <select name="action" defaultValue={selected.status === "scheduled" ? "sponsored" : selected.status}>
                  <option value="sponsored">Sponsored meal (replaces standard meal)</option>
                  <option value="cancelled">Emergency cancellation</option>
                  <option value="modified">Modify menu</option>
                  <option value="scheduled">Restore standard meal</option>
                </select>
              </Field>
              <Field label="Reason">
                <input name="reason" placeholder="e.g. Lunch sponsored by the Alumni Association" maxLength={300} />
              </Field>
              <Field label="Replacement / sponsored menu (optional)">
                <input name="menu_override" placeholder="e.g. Biryani, raita, gulab jamun" maxLength={400} />
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="notify" defaultChecked /> Notify students, teachers and kitchen
              </label>
              <SubmitButton>Apply change</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      )}
    </>
  );
}

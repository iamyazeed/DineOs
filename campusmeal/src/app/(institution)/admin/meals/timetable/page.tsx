import { requireRole } from "@/lib/auth/guards";
import { setScheduleActive, upsertSchedule } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { WEEKDAYS } from "@/lib/constants";
import { fmtTime } from "@/lib/utils";
import type { Schedule } from "@/features/meals/queries";

function ScheduleFields({ s, halls }: { s?: Schedule; halls: Array<{ id: string; name: string }> }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="form-grid">
        <Field label="Meal name">
          <input name="name" required defaultValue={s?.name} placeholder="e.g. Lunch" maxLength={60} />
        </Field>
        <Field label="Serving time">
          <input name="serve_time" type="time" required defaultValue={s?.serve_time.slice(0, 5) ?? "12:30"} />
        </Field>
        <Field label="Cancel by (days before)">
          <input name="cancel_days_before" type="number" min={0} max={7} required defaultValue={s?.cancel_days_before ?? 1} />
        </Field>
        <Field label="Cancel by (time)">
          <input name="cancel_time" type="time" required defaultValue={s?.cancel_time.slice(0, 5) ?? "20:00"} />
        </Field>
      </div>
      <div>
        <div className="mb-1 text-[12px] font-semibold text-dim">Served on</div>
        <div className="flex flex-wrap gap-3 text-[13px]">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1.5">
              <input type="checkbox" name="weekdays[]" value={i} defaultChecked={s ? s.weekdays.includes(i) : true} /> {d}
            </label>
          ))}
        </div>
      </div>
      {halls.length > 1 && (
        <div>
          <div className="mb-1 text-[12px] font-semibold text-dim">Dining halls (none selected = all halls)</div>
          <div className="flex flex-wrap gap-3 text-[13px]">
            {halls.map((h) => (
              <label key={h.id} className="flex items-center gap-1.5">
                <input type="checkbox" name="hall_ids[]" value={h.id} defaultChecked={s?.hall_ids?.includes(h.id) ?? false} /> {h.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default async function Timetable() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const [{ data: schedules }, { data: halls }] = await Promise.all([
    ctx.supabase.from("meal_schedules").select("*").eq("institution_id", inst.id).order("serve_time"),
    ctx.supabase.from("dining_halls").select("id, name").eq("institution_id", inst.id).order("sort_order"),
  ]);
  const list = (schedules ?? []) as Schedule[];
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Meal timetable" sub="Your fixed daily timetable. Configure it once — every day's meals are generated from it automatically and start as On Time." />
      <div className="mt-5" />
      {list.length === 0 && (
        <Panel>
          <EmptyState>No meals configured yet. Add breakfast, lunch, dinner or any institution-defined meal below.</EmptyState>
        </Panel>
      )}
      {list.map((s) => (
        <Panel
          key={s.id}
          title={
            <span className="flex items-center gap-2">
              {s.name} <span className="mono text-[12px] text-dim">{fmtTime(s.serve_time)}</span> {!s.active && <Pill tone="bad">Paused</Pill>}
            </span>
          }
          sub={`${s.weekdays.length === 7 ? "Every day" : s.weekdays.map((d) => WEEKDAYS[d]).join(", ")} · cancel ${s.cancel_days_before === 0 ? "same day" : `${s.cancel_days_before} day(s) before`} by ${fmtTime(s.cancel_time)} · ${s.hall_ids ? `${s.hall_ids.length} hall(s)` : "all halls"}`}
          actions={
            <ActionForm action={setScheduleActive} inline>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value={String(!s.active)} />
              <SubmitButton size="sm" variant={s.active ? "danger" : "teal"}>
                {s.active ? "Pause" : "Resume"}
              </SubmitButton>
            </ActionForm>
          }
        >
          <details className="disclosure">
            <summary className="text-[13px] font-semibold text-amber">Edit</summary>
            <ActionForm action={upsertSchedule} className="mt-3">
              <ScheduleFields s={s} halls={halls ?? []} />
              <div>
                <SubmitButton>Save changes</SubmitButton>
              </div>
            </ActionForm>
          </details>
        </Panel>
      ))}
      <Panel title="Add a meal" sub="Default deadline: previous day at the campus default time">
        <ActionForm action={upsertSchedule} resetOnSuccess>
          <ScheduleFields halls={halls ?? []} />
          <div>
            <SubmitButton>Add meal</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}

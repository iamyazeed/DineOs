import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { saveMenu } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { WEEKDAYS } from "@/lib/constants";
import { fmtTime } from "@/lib/utils";

export default async function MenuManagement() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const [{ data: schedules }, { data: menus }] = await Promise.all([
    ctx.supabase.from("meal_schedules").select("id, name, serve_time, weekdays, active").eq("institution_id", inst.id).order("serve_time"),
    ctx.supabase.from("meal_menus").select("schedule_id, weekday, items").eq("institution_id", inst.id),
  ]);
  const menuMap = new Map((menus ?? []).map((m) => [`${m.schedule_id}:${m.weekday}`, m.items as string]));
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Menu management"
        sub={
          <>
            The standing weekly menu is published to students and teachers and repeats every week. For a one-day change use{" "}
            <Link href="/admin/meals" className="underline">daily exceptions</Link>.
          </>
        }
      />
      <div className="mt-5" />
      {(schedules ?? []).length === 0 && (
        <Panel>
          <EmptyState>
            Add meals to the <Link href="/admin/meals/timetable" className="underline">timetable</Link> first.
          </EmptyState>
        </Panel>
      )}
      {(schedules ?? []).map((s) => (
        <Panel key={s.id} title={`${s.name} · ${fmtTime(s.serve_time)}`} sub={s.active ? "Published weekly menu" : "Paused meal"}>
          <div className="grid gap-2">
            {s.weekdays
              .slice()
              .sort((a: number, b: number) => ((a + 6) % 7) - ((b + 6) % 7))
              .map((d: number) => (
                <ActionForm key={d} action={saveMenu} inline className="w-full">
                  <input type="hidden" name="schedule_id" value={s.id} />
                  <input type="hidden" name="weekday" value={d} />
                  <span className="w-10 text-[12.5px] font-bold text-dim">{WEEKDAYS[d]}</span>
                  <input className="input min-w-[220px] flex-1" name="items" defaultValue={menuMap.get(`${s.id}:${d}`) ?? ""} placeholder="Menu items" maxLength={400} />
                  <SubmitButton size="sm" variant="ghost">
                    Publish
                  </SubmitButton>
                </ActionForm>
              ))}
          </div>
        </Panel>
      ))}
    </>
  );
}

import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { updateInstitutionDefaults } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, KV, PageHeader, Panel, StatCard } from "@/components/ui/primitives";

export default async function CampusConfiguration() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const [halls, tables, students, classes, schedules] = await Promise.all([
    db.from("dining_halls").select("id, active").eq("institution_id", inst.id),
    db.from("dining_tables").select("id, capacity, active").eq("institution_id", inst.id),
    db.from("students").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).eq("active", true),
    db.from("classes").select("id", { count: "exact", head: true }).eq("institution_id", inst.id),
    db.from("meal_schedules").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).eq("active", true),
  ]);
  const activeTables = (tables.data ?? []).filter((t) => t.active);
  const seats = activeTables.reduce((a, t) => a + (t.capacity ?? inst.default_table_capacity), 0);
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Campus configuration" sub="Set your campus structure and operating defaults once. They stay active every day until you change them." />
      <div className="grid-stat">
        <StatCard label="Dining halls" value={(halls.data ?? []).filter((h) => h.active).length} hint={`${(halls.data ?? []).length} configured`} icon="building" />
        <StatCard label="Active tables" value={activeTables.length} hint={`${seats} seats in total`} icon="seat" tone="teal" />
        <StatCard label="Active students" value={students.count ?? 0} hint={`${classes.count ?? 0} classes`} icon="users" />
        <StatCard label="Daily meals" value={schedules.count ?? 0} hint="From the standing timetable" icon="clock" tone="good" />
      </div>
      <div className="cols">
        <Panel title="Operating defaults">
          <ActionForm action={updateInstitutionDefaults}>
            <div className="form-grid">
              <Field label="Institution name">
                <input name="name" defaultValue={inst.name} required maxLength={120} />
              </Field>
              <Field label="Timezone (IANA)">
                <input name="timezone" defaultValue={inst.timezone} required />
              </Field>
              <Field label="Default table capacity">
                <input name="default_table_capacity" type="number" min={1} max={100} defaultValue={inst.default_table_capacity} required />
              </Field>
              <Field label="Supplier rotation (days)">
                <input name="supplier_rotation_days" type="number" min={1} max={120} defaultValue={inst.supplier_rotation_days} required />
              </Field>
              <Field label="Cancellation deadline: days before">
                <input name="default_cancel_days_before" type="number" min={0} max={7} defaultValue={inst.default_cancel_days_before} required />
              </Field>
              <Field label="Cancellation deadline: time">
                <input name="default_cancel_time" type="time" defaultValue={inst.default_cancel_time.slice(0, 5)} required />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="apply_to_schedules" /> Also apply the deadline to every existing meal in the timetable
            </label>
            <div>
              <SubmitButton>Save defaults</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
        <Panel title="Structure" sub="Manage the pieces of your campus">
          <KV k={<Link className="underline" href="/admin/dining/halls">Dining halls & tables</Link>} v={`${(halls.data ?? []).length} halls · ${(tables.data ?? []).length} tables`} />
          <KV k={<Link className="underline" href="/admin/dining/tables">Seat assignments</Link>} v="Fixed per student" />
          <KV k={<Link className="underline" href="/admin/classes">Classes & class teachers</Link>} v={classes.count ?? 0} />
          <KV k={<Link className="underline" href="/admin/students">Students & teachers</Link>} v={students.count ?? 0} />
          <KV k={<Link className="underline" href="/admin/meals/timetable">Meal timetable</Link>} v={`${schedules.count ?? 0} meals`} />
          <KV k={<Link className="underline" href="/admin/meals/menu">Weekly menu</Link>} v="Published" />
          <p className="mt-3 text-[12px] text-faint">Supplier rotation is managed by teachers.</p>
        </Panel>
      </div>
    </>
  );
}

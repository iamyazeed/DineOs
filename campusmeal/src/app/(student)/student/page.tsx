import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getStudentMeals } from "@/features/cancellations/queries";
import { StudentMealRow } from "@/components/shared/student-meal-row";
import { AnnouncementsFeed } from "@/components/shared/announcements-feed";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "@/components/ui/primitives";
import { addDays, fmtDate, todayIn } from "@/lib/utils";

export default async function StudentOverview() {
  const ctx = await requireRole("student");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const [{ me, meals }, table] = await Promise.all([getStudentMeals(db, inst, ctx.userId, today, 2), db.rpc("my_table", { p_date: today })]);
  const myRow = (table.data ?? []).find((r: { is_me: boolean }) => r.is_me) as { table_code: string; hall_name: string } | undefined;
  const supplier = (table.data ?? []).find((r: { is_supplier: boolean }) => r.is_supplier) as { mate_name: string } | undefined;
  const todayMeals = meals.filter((m) => m.meal_date === today);
  const tomorrow = meals.filter((m) => m.meal_date === addDays(today, 1));
  return (
    <>
      <PageHeader eyebrow={fmtDate(today, { weekday: "long", day: "numeric", month: "long" })} title={`Hi, ${(me?.full_name ?? ctx.fullName).split(" ")[0]}`} sub="Your meals, your table and campus dining notices." />
      {!me && (
        <div className="mt-4">
          <Notice tone="warn">Your login is not linked to a student record yet. Please contact the institution admin.</Notice>
        </div>
      )}
      <div className="grid-stat">
        <StatCard label="My table" value={myRow?.table_code ?? "—"} hint={myRow?.hall_name ?? "Not assigned"} icon="seat" tone="teal" />
        <StatCard label="Table supplier" value={<span className="text-[18px]">{supplier?.mate_name ?? "—"}</span>} hint="Collects food for your table" icon="users" />
        <StatCard label="Meals today" value={todayMeals.filter((m) => m.status !== "cancelled" && !m.cancelled).length} hint="That you are eating" icon="check" tone="good" />
      </div>
      <div className="cols">
        <div>
          <Panel title="Today" actions={<Link href="/student/menu" className="btn btn-ghost btn-sm">Menu</Link>}>
            {todayMeals.length === 0 ? <EmptyState>No meals today.</EmptyState> : todayMeals.map((m) => <StudentMealRow key={m.id} m={m} />)}
          </Panel>
          <Panel title="Tomorrow" sub="Cancel before the deadline if you won't eat" actions={<Link href="/student/cancellation" className="btn btn-ghost btn-sm">All upcoming</Link>}>
            {tomorrow.length === 0 ? <EmptyState>No meals tomorrow.</EmptyState> : tomorrow.map((m) => <StudentMealRow key={m.id} m={m} />)}
          </Panel>
        </div>
        <Panel title="Announcements">
          <AnnouncementsFeed db={db} instId={inst.id} limit={6} />
        </Panel>
      </div>
    </>
  );
}

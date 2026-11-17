import { requireRole } from "@/lib/auth/guards";
import { getStudentMeals } from "@/features/cancellations/queries";
import { StudentMealRow } from "@/components/shared/student-meal-row";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/ui/primitives";
import { todayIn } from "@/lib/utils";

export default async function CancelMeal() {
  const ctx = await requireRole("student");
  const inst = ctx.institution!;
  const today = todayIn(inst.timezone);
  const { me, meals } = await getStudentMeals(ctx.supabase, inst, ctx.userId, today, 8);
  const open = meals.filter((m) => m.canChange);
  const closed = meals.filter((m) => !m.canChange);
  return (
    <>
      <PageHeader
        eyebrow="Meal cancellation"
        title="Cancel a meal"
        sub="Not eating? Cancel before the deadline (usually 8 PM the day before) so the kitchen doesn't prepare your portion. You can undo until the deadline."
      />
      <div className="mt-5" />
      {!me ? (
        <Notice tone="warn">Your login is not linked to a student record yet.</Notice>
      ) : (
        <>
          <Panel title="Open for changes" sub={`${open.filter((m) => m.cancelled).length} cancelled`}>
            {open.length === 0 ? <EmptyState>No upcoming meals are open for cancellation.</EmptyState> : open.map((m) => <StudentMealRow key={m.id} m={m} showDate />)}
          </Panel>
          <Panel title="Deadline passed" sub="Late changes need your teacher or the institution admin">
            {closed.length === 0 ? <EmptyState>None.</EmptyState> : closed.map((m) => <StudentMealRow key={m.id} m={m} showDate />)}
          </Panel>
        </>
      )}
    </>
  );
}

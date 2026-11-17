import { requireRole } from "@/lib/auth/guards";
import { getRecentSeparateRequests } from "@/features/special-food/queries";
import { SeparateRequestList } from "@/components/shared/separate-requests";
import { PageHeader, Panel, StatCard } from "@/components/ui/primitives";

export default async function AdminSpecialFood() {
  const ctx = await requireRole("institution_admin");
  const { rows, mealLabel, studentName } = await getRecentSeparateRequests(ctx.supabase, ctx.institution!);
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");
  return (
    <>
      <PageHeader eyebrow="Separate food" title="Special food requests" sub="Class teachers request separate food for specific students. Approved requests go to the kitchen as separate portions — never merged into the regular count." />
      <div className="grid-stat">
        <StatCard label="Awaiting review" value={pending.length} icon="alert" tone="bad" />
        <StatCard label="Approved portions (window)" value={rows.filter((r) => r.status === "approved").reduce((a, r) => a + r.portions, 0)} icon="star" tone="good" />
        <StatCard label="Requests (yesterday to next week)" value={rows.length} icon="file" tone="teal" />
      </div>
      <div className="cols-2">
        <Panel title="Pending review">
          <SeparateRequestList rows={pending} mealLabel={mealLabel} studentName={studentName} review />
        </Panel>
        <Panel title="Reviewed">
          <SeparateRequestList rows={decided} mealLabel={mealLabel} studentName={studentName} />
        </Panel>
      </div>
    </>
  );
}

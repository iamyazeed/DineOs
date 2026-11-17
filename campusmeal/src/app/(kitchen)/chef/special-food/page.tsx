import { requireRole } from "@/lib/auth/guards";
import { getRecentSeparateRequests } from "@/features/special-food/queries";
import { SeparateRequestList } from "@/components/shared/separate-requests";
import { PageHeader, Panel } from "@/components/ui/primitives";

export default async function ChefSpecialFood() {
  const ctx = await requireRole("chef");
  // RLS only returns APPROVED requests to the chef.
  const { rows, mealLabel, studentName } = await getRecentSeparateRequests(ctx.supabase, ctx.institution!);
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Special food requests" sub="Approved separate food requirements. These are prepared separately and are not part of the regular count." />
      <div className="mt-5" />
      <Panel>
        <SeparateRequestList rows={rows} mealLabel={mealLabel} studentName={studentName} />
      </Panel>
    </>
  );
}

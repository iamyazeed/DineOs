import { requireRole } from "@/lib/auth/guards";
import { ServiceRequestList } from "@/components/shared/service-requests";
import { PageHeader, Panel } from "@/components/ui/primitives";

export default async function AdminServiceRequests() {
  const ctx = await requireRole("institution_admin");
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Kitchen service requests" sub="Requests raised by the chef. Approve or reject, update status and add notes." />
      <div className="mt-5" />
      <Panel>
        <ServiceRequestList db={ctx.supabase} instId={ctx.institution!.id} manage />
      </Panel>
    </>
  );
}

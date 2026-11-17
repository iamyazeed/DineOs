import type { SupabaseClient } from "@supabase/supabase-js";
import { updateServiceRequest } from "@/features/service-requests/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Pill } from "@/components/ui/primitives";
import { StatusPill } from "@/components/shared/status";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/utils";

export async function ServiceRequestList({ db, instId, manage }: { db: SupabaseClient; instId: string; manage?: boolean }) {
  const { data } = await db
    .from("kitchen_service_requests")
    .select("id, category, title, details, priority, status, admin_note, created_at, updated_at")
    .eq("institution_id", instId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (!data?.length) return <EmptyState>No service requests yet.</EmptyState>;
  return (
    <div className="grid gap-3">
      {data.map((r) => (
        <article key={r.id} className="glass rounded-[14px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[14px] font-semibold">{r.title}</div>
              <div className="text-[12px] text-dim">
                {SERVICE_CATEGORIES[r.category as keyof typeof SERVICE_CATEGORIES]} · {fmtDateTime(r.created_at)}
              </div>
            </div>
            <div className="flex gap-2">
              {r.priority === "urgent" && <Pill tone="bad">Urgent</Pill>}
              <StatusPill status={r.status} />
            </div>
          </div>
          {r.details && <p className="mt-2 text-[13px]">{r.details}</p>}
          {r.admin_note && !manage && (
            <p className="mt-2 text-[12.5px]">
              <span className="text-dim">Admin note:</span> {r.admin_note}
            </p>
          )}
          {manage && (
            <ActionForm action={updateServiceRequest} inline className="mt-3">
              <input type="hidden" name="id" value={r.id} />
              <select name="status" defaultValue={r.status} className="input w-40" aria-label="Status">
                <option value="open">Open</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
              <input name="admin_note" defaultValue={r.admin_note ?? ""} className="input min-w-[200px] flex-1" placeholder="Administrative note" maxLength={500} />
              <SubmitButton size="sm">Update</SubmitButton>
            </ActionForm>
          )}
        </article>
      ))}
    </div>
  );
}

import type { SeparateRequestRow } from "@/features/meals/queries";
import { reviewSeparateFoodRequest } from "@/features/special-food/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/primitives";
import { StatusPill } from "@/components/shared/status";
import { fmtDateTime } from "@/lib/utils";

/** Separate-food request cards. `review` adds admin approve/reject controls. */
export function SeparateRequestList({
  rows,
  mealLabel,
  studentName,
  review,
}: {
  rows: SeparateRequestRow[];
  mealLabel: (id: string) => string;
  studentName: (id: string) => string;
  review?: boolean;
}) {
  if (rows.length === 0) return <EmptyState>No separate food requests.</EmptyState>;
  return (
    <div className="grid gap-3">
      {rows.map((r) => (
        <article key={r.id} className="glass rounded-[14px] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[14px] font-semibold">{r.requirement}</div>
              <div className="text-[12px] text-dim">
                {r.class_name} · {mealLabel(r.meal_id)} · <span className="mono">{r.portions}</span> portion(s)
              </div>
            </div>
            <StatusPill status={r.status} />
          </div>
          <div className="mt-2 grid gap-1 text-[12.5px]">
            <div>
              <span className="text-dim">Students: </span>
              {r.student_ids.map(studentName).join(", ")}
            </div>
            {r.dietary_info && (
              <div>
                <span className="text-dim">Dietary: </span>
                {r.dietary_info}
              </div>
            )}
            {r.reason && (
              <div>
                <span className="text-dim">Reason: </span>
                {r.reason}
              </div>
            )}
            {r.review_note && (
              <div>
                <span className="text-dim">Admin note: </span>
                {r.review_note}
              </div>
            )}
            <div className="text-[11px] text-faint">Submitted {fmtDateTime(r.created_at)}</div>
          </div>
          {review && r.status === "pending" && (
            <ActionForm action={reviewSeparateFoodRequest} inline className="mt-3">
              <input type="hidden" name="id" value={r.id} />
              <input className="input min-w-[200px] flex-1" name="review_note" placeholder="Note (optional)" maxLength={300} />
              <SubmitButton size="sm" name="decision" value="approved">
                Approve
              </SubmitButton>
              <SubmitButton size="sm" variant="danger" name="decision" value="rejected">
                Reject
              </SubmitButton>
            </ActionForm>
          )}
        </article>
      ))}
    </div>
  );
}

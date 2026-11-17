import { updateMissingReport } from "@/features/kitchen/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState } from "@/components/ui/primitives";
import { StatusPill } from "@/components/shared/status";
import { fmtDateTime } from "@/lib/utils";

interface Row {
  id: string;
  table_code: string | null;
  portions_missing: number;
  note: string;
  status: string;
  created_at: string;
  meal_label?: string;
}

export function MissingReportList({ rows, resolveAs }: { rows: Row[]; resolveAs?: "chef" | "institution_admin" }) {
  if (rows.length === 0) return <EmptyState>No missing-meal reports.</EmptyState>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} className="list-row items-start text-[13px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={r.status} />
              <span className="mono font-bold">{r.table_code ?? "General"}</span>
              <span className="text-dim">
                {r.portions_missing} portion(s) {r.meal_label && `· ${r.meal_label}`}
              </span>
            </div>
            <p className="mt-1">{r.note}</p>
            <div className="text-[11px] text-faint">{fmtDateTime(r.created_at)}</div>
          </div>
          {resolveAs && r.status !== "resolved" && (
            <ActionForm action={updateMissingReport} inline>
              <input type="hidden" name="role" value={resolveAs} />
              <input type="hidden" name="id" value={r.id} />
              {r.status === "open" && (
                <SubmitButton size="sm" variant="ghost" name="status" value="acknowledged">
                  Acknowledge
                </SubmitButton>
              )}
              <SubmitButton size="sm" variant="teal" name="status" value="resolved">
                Resolved
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      ))}
    </div>
  );
}

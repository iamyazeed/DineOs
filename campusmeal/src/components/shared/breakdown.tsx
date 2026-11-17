import type { Bucket, MealBreakdown } from "@/features/meals/calc";
import { EmptyState, Notice, Panel, StatCard } from "@/components/ui/primitives";

/** Headline meal requirement figures. */
export function BreakdownStats({ b }: { b: MealBreakdown }) {
  return (
    <>
      {!b.active && <Notice tone="bad">This meal is cancelled — nothing should be prepared. Counts are kept for reporting only.</Notice>}
      <div className="grid-stat">
        <StatCard label="Expected students" value={b.eligible} hint="Seated, active, hall in service" icon="users" tone="teal" />
        <StatCard label="Regular meal portions" value={b.regular} hint="After cancellations & absences" icon="check" />
        <StatCard
          label="Separate food portions"
          value={b.separatePortions}
          hint={`${b.separateStudents} students · approved requests only${b.pendingSeparateRequests ? ` · ${b.pendingSeparateRequests} pending` : ""}`}
          icon="star"
          tone="good"
        />
        <StatCard label="Not attending" value={b.excluded} hint={`${b.cancelled} cancelled · ${b.absent} reported absent`} icon="x" tone="bad" />
      </div>
    </>
  );
}

export function BucketTable({ rows, labelHeader }: { rows: Bucket[]; labelHeader: string }) {
  if (rows.length === 0) return <EmptyState>Nothing to show.</EmptyState>;
  const total = rows.reduce(
    (a, r) => ({ assigned: a.assigned + r.assigned, excluded: a.excluded + r.excluded, separate: a.separate + r.separate, regular: a.regular + r.regular }),
    { assigned: 0, excluded: 0, separate: 0, regular: 0 },
  );
  return (
    <div className="tablewrap">
      <table className="data">
        <thead>
          <tr>
            <th>{labelHeader}</th>
            <th className="num">Assigned</th>
            <th className="num">Not attending</th>
            <th className="num">Separate</th>
            <th className="num">Regular</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-semibold">{r.label}</td>
              <td className="num">{r.assigned}</td>
              <td className="num">{r.excluded}</td>
              <td className="num">{r.separate}</td>
              <td className="num font-bold">{r.regular}</td>
            </tr>
          ))}
          <tr>
            <td className="font-bold">Total</td>
            <td className="num">{total.assigned}</td>
            <td className="num">{total.excluded}</td>
            <td className="num">{total.separate}</td>
            <td className="num font-bold">{total.regular}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function HallClassPanels({ b }: { b: MealBreakdown }) {
  return (
    <div className="cols-2">
      <Panel title="Hall-wise quantities" sub="Regular portions per dining hall">
        <BucketTable rows={b.byHall} labelHeader="Hall" />
      </Panel>
      <Panel title="Class-wise totals" sub="Regular and separate portions per class">
        <BucketTable rows={b.byClass} labelHeader="Class" />
      </Panel>
    </div>
  );
}

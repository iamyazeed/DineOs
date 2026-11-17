import { EmptyState } from "@/components/ui/primitives";

export function HBarChart({ rows, unit }: { rows: Array<{ label: string; value: number }>; unit?: string }) {
  if (rows.length === 0) return <EmptyState>No data yet.</EmptyState>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r) => (
        <div className="hbar" key={r.label}>
          <span className="lbl" title={r.label}>
            {r.label}
          </span>
          <div className="bar">
            <i style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="mono text-right">
            {r.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Simple column chart; `b` renders a second (teal) series. */
export function ColumnChart({ rows }: { rows: Array<{ label: string; a: number; b?: number; title?: string }> }) {
  if (rows.length === 0) return <EmptyState>No data yet.</EmptyState>;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.b ?? 0)));
  return (
    <div className="vchart" role="img" aria-label="Column chart">
      {rows.map((r) => (
        <div className="col" key={r.label} title={r.title ?? `${r.label}: ${r.a}`}>
          <div className="flex h-full w-full items-end justify-center gap-[3px]">
            <i style={{ height: `${(r.a / max) * 100}%` }} />
            {r.b !== undefined && <i className="teal" style={{ height: `${(r.b / max) * 100}%` }} />}
          </div>
          <small>{r.label}</small>
        </div>
      ))}
    </div>
  );
}

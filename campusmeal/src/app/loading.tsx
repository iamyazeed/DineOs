export default function Loading() {
  return (
    <div className="pagewrap" aria-busy="true" aria-live="polite">
      <div className="mb-3 h-7 w-56 animate-pulse rounded-lg" style={{ background: "var(--glass2)" }} />
      <div className="grid-stat">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="statc glass h-[110px] animate-pulse" />
        ))}
      </div>
      <div className="panel glass h-64 animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Shimmering placeholder shown while a dashboard page loads. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="sk mb-2 h-4 w-28" />
      <div className="sk mb-6 h-8 w-72" />
      <div className="grid-stat">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="statc glass" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="sk mb-3 h-3 w-20" />
            <div className="sk mb-2 h-7 w-16" />
            <div className="sk h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="panel glass">
        <div className="sk mb-4 h-5 w-48" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3" style={{ borderTop: i ? "1px solid var(--line)" : undefined }}>
            <div className="sk h-9 w-9 rounded-full" />
            <div className="flex-1">
              <div className="sk mb-2 h-3.5" style={{ width: `${60 - i * 6}%` }} />
              <div className="sk h-3 w-1/3" />
            </div>
            <div className="sk h-6 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="panel glass max-w-md text-center" style={{ padding: 28 }}>
        <div className="eyebrow mb-2">Something went wrong</div>
        <h1 className="font-d mb-2 text-[24px]">We couldn&apos;t load this page</h1>
        <p className="sub mb-4 break-words">{error.message || "Unexpected error"}</p>
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}

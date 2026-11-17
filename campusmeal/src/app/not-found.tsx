import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="panel glass fu max-w-md text-center" style={{ padding: 30 }}>
        <div className="eyebrow mb-2">404</div>
        <h1 className="font-d mb-2 text-[26px]">Page not found</h1>
        <p className="sub mb-5">The page you were looking for doesn&apos;t exist.</p>
        <Link href="/" className="btn btn-primary">
          Back to CampusMeal
        </Link>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

/** The notched "D" of the DineOS wordmark (inherits text colour). */
export function LogoD({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 90" fill="currentColor" aria-hidden="true">
      {/* top bar + bowl + bottom bar */}
      <path d="M0 0H55A45 45 0 0 1 55 90H3L21 74H55A29 29 0 0 0 55 16H0Z" />
      {/* stem with diagonal cut */}
      <path d="M0 31H20V66L0 89Z" />
    </svg>
  );
}

/** DineOS wordmark. Size it with font-size (e.g. text-[22px]). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("logo", className)} role="img" aria-label="DineOS">
      <LogoD className="logo-d" />
      <span className="logo-ink">ine</span>
      <span className="logo-os">OS</span>
    </span>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icon";

export type Tone = "good" | "warn" | "bad" | "teal" | "dim";

export function Pill({ tone = "dim", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("pill", `pill-${tone}`)}>
      {dot && <i className="dot" />}
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="fu flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="h1 font-d">{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "amber",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  tone?: "amber" | "teal" | "good" | "bad";
}) {
  const color = { amber: "var(--amber)", teal: "var(--teal2)", good: "var(--good)", bad: "var(--bad)" }[tone];
  return (
    <div className="statc glass fu">
      {icon && (
        <div className="ico" style={{ color, background: "var(--glass2)", border: "1px solid var(--line)" }}>
          <Icon name={icon} size={17} />
        </div>
      )}
      <div className="lbl">{label}</div>
      <div className="num">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Panel({
  title,
  sub,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("panel glass fu", className)}>
      {(title || actions) && (
        <div className="ph">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <small>{sub}</small>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Notice({ tone, children }: { tone?: "warn" | "bad" | "good"; children: ReactNode }) {
  return <div className={cn("notice", tone && `notice-${tone}`)}>{children}</div>;
}

export function ProgressBar({ value, bad }: { value: number; bad?: boolean }) {
  return (
    <div className={cn("bar", bad && "bad")} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("field", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="kv">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

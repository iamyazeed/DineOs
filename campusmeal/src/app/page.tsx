import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/layouts/role-shell";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionContext } from "@/lib/auth/guards";
import { ROLE_HOME } from "@/lib/constants";

const STEPS = [
  { title: "Publish the menu", text: "Set the weekly timetable once. It repeats every day until you change it." },
  { title: "Students cancel early", text: "Anyone skipping a meal cancels before the cut-off, so the kitchen cooks for real numbers." },
  { title: "Teachers confirm", text: "Class absences and special diets are checked once, with no double counting." },
  { title: "Kitchen prepares", text: "Final counts arrive split by hall, table and class." },
  { title: "Tables are served", text: "Delivery and pickup are marked table by table as they happen." },
  { title: "Admins review", text: "Attendance, waste and costs for each institution, from the same records." },
];

const ROLES = [
  { role: "Students", text: "See today's menu, cancel a meal, check your table." },
  { role: "Teachers", text: "Mark attendance, approve special food, track your tables." },
  { role: "Kitchen", text: "Counts, ingredients and preparation in one list." },
  { role: "Admins", text: "Set up halls and classes, then watch the numbers." },
];

export default async function Home() {
  if (isSupabaseConfigured()) {
    const session = await getSessionContext();
    if (session?.memberships[0]) redirect(ROLE_HOME[session.memberships[0].role]);
  }
  return (
    <div className="mx-auto max-w-6xl px-3 pb-6 sm:px-4">
      <header className="site-header">
        <Brand sub="Campus dining" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </header>

      <section className="py-14 md:py-20">
        <div className="eyebrow mb-4">DineOS · Canteen management</div>
        <h1 className="font-d max-w-3xl text-[40px] md:text-[60px]">
          Cook for the people <em>who show up.</em>
        </h1>
        <p className="sub mt-5 max-w-xl text-[16px]">
          Students cancel meals they will skip, teachers confirm their classes, and the kitchen gets a count it can trust.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/login" className="btn btn-primary">
            Open your dashboard <ArrowRight size={16} aria-hidden />
          </Link>
          <a href="#how" className="btn btn-ghost">
            How it works
          </a>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r.role} className="panel glass" style={{ marginBottom: 0 }}>
            <h3 className="mb-1">{r.role}</h3>
            <p className="text-[13.5px] text-dim">{r.text}</p>
          </div>
        ))}
      </section>

      <section id="how" className="mt-16">
        <h2 className="font-d mb-6 text-[26px]">How it works</h2>
        <ol className="grid gap-x-8 gap-y-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <div className="step-num mb-2">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="mb-1 text-[16px] font-semibold">{s.title}</h3>
              <p className="text-[13.5px] text-dim">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="site-footer">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[18px] font-bold tracking-tight">DineOS</div>
            <p className="muted mt-1 max-w-sm text-[13px]">Meal planning, attendance and distribution for campus canteens.</p>
          </div>
          <div className="flex gap-5 text-[13px] font-semibold">
            <Link href="/login">Sign in</Link>
            <a href="#how">How it works</a>
          </div>
        </div>
        <div className="muted mt-6 border-t pt-4 text-[12px]" style={{ borderColor: "rgba(255,255,255,.12)" }}>
          © {new Date().getFullYear()} DineOS
        </div>
      </footer>
    </div>
  );
}

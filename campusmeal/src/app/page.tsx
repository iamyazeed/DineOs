import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/layouts/role-shell";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { Icon, type IconName } from "@/components/ui/icon";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionContext } from "@/lib/auth/guards";
import { ROLE_HOME } from "@/lib/constants";

const FLOW: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: "menu", title: "Menu published", text: "A standing timetable and weekly menu, set once and reused every day." },
  { icon: "x", title: "Students cancel", text: "Cancel before the deadline so the kitchen never cooks for empty seats." },
  { icon: "check", title: "Teachers reconcile", text: "Class absences and separate food needs, never double-counted." },
  { icon: "flame", title: "Kitchen prepares", text: "Approved counts by hall, table and class, with live progress." },
  { icon: "truck", title: "Tables served", text: "Delivery, collection and distribution tracked table by table." },
  { icon: "chart", title: "Leaders see it all", text: "Institution and university analytics from the same records." },
];

export default async function Home() {
  if (isSupabaseConfigured()) {
    const session = await getSessionContext();
    if (session?.memberships[0]) redirect(ROLE_HOME[session.memberships[0].role]);
  }
  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <header className="flex items-center justify-between py-5">
        <Brand sub="Campus dining ops" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      </header>
      <section className="fu py-14 md:py-20">
        <div className="eyebrow mb-4">Intelligent Campus Dining Operations</div>
        <h1 className="font-d max-w-3xl text-[40px] md:text-[60px]">The right meals, to the right people, at the right time.</h1>
        <p className="sub mt-5 max-w-2xl text-[16px]">
          DineOS connects student meal decisions, teacher coordination, kitchen preparation and institutional monitoring in one multi-tenant platform —
          so campuses cook what is actually needed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary">
            Open your dashboard
          </Link>
          <a href="#how" className="btn btn-ghost">
            How it works
          </a>
        </div>
      </section>
      <section id="how" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FLOW.map((f, i) => (
          <div key={f.title} className="panel glass fu" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: "color-mix(in srgb, var(--amber) 16%, transparent)", color: "var(--amber)" }}>
                <Icon name={f.icon} />
              </span>
              <span className="mono text-[12px] text-faint">0{i + 1}</span>
            </div>
            <h3 className="mb-1">{f.title}</h3>
            <p className="text-[13.5px] text-dim">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

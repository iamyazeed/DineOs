import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import { ArrowRight, BarChart3, ChefHat, ClipboardCheck, GraduationCap, LogIn, ShieldCheck, Smartphone, Truck, UtensilsCrossed, Users } from "lucide-react";
import { Brand } from "@/components/layouts/role-shell";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { Clipboard, Dashboard, DeliveryCart, DiningTable, HeroScene, KitchenPot, PhoneMenu } from "@/components/landing/illustrations";
import { isSupabaseConfigured } from "@/config/env";
import { getSessionContext } from "@/lib/auth/guards";
import { ROLE_HOME } from "@/lib/constants";

type Icon = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

const ROLES: { role: string; text: string; icon: Icon; Art: () => React.JSX.Element }[] = [
  { role: "Students", text: "See today's menu, cancel a meal before the cut-off, find your table.", icon: Smartphone, Art: PhoneMenu },
  { role: "Teachers", text: "Mark class attendance, approve special food, rotate table suppliers.", icon: GraduationCap, Art: Clipboard },
  { role: "Kitchen", text: "Exact counts, quantities, ingredients and shortages for every meal.", icon: ChefHat, Art: KitchenPot },
  { role: "Admins", text: "Set up halls, classes and tables, add people in bulk, read analytics.", icon: BarChart3, Art: Dashboard },
];

const STEPS = [
  { title: "Students cancel early", text: "Anyone skipping a meal cancels before the cut-off, so the kitchen cooks for real numbers.", Art: PhoneMenu },
  { title: "Teachers confirm", text: "Absences and special diets are checked once per class, with no double counting.", Art: Clipboard },
  { title: "Kitchen cooks the count", text: "Final portions arrive split by hall, table and class, plus separate diet portions.", Art: KitchenPot },
  { title: "Tables are served", text: "Each table has a monthly student supplier; delivery is marked table by table.", Art: DeliveryCart },
];

const STATS = [
  { n: "5", label: "roles, each with its own workspace" },
  { n: "1", label: "rule for the count, shared by app and database" },
  { n: "CSV", label: "paste or upload to add hundreds of people" },
  { n: "RLS", label: "every campus sees only its own data" },
];

export default async function Home() {
  if (isSupabaseConfigured()) {
    const session = await getSessionContext();
    if (session?.memberships[0]) redirect(ROLE_HOME[session.memberships[0].role]);
  }
  const year = new Date().getFullYear();
  return (
    <div className="landing">
      <div className="mx-auto max-w-6xl px-3 pb-6 sm:px-4">
        <header className="site-header">
          <Brand sub="Campus dining" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/login" className="btn btn-primary">
              <LogIn size={16} aria-hidden /> Sign in
            </Link>
          </div>
        </header>

        <section className="grid items-center gap-8 py-12 md:grid-cols-[1.1fr_1fr] md:py-16">
          <div>
            <div className="eyebrow mb-4">DineOS · Canteen management</div>
            <h1 className="font-d text-[40px] md:text-[58px]">
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
          </div>
          <HeroScene />
        </section>

        <section>
          <div className="eyebrow mb-2">Who it&apos;s for</div>
          <h2 className="font-d mb-6 text-[26px]">Choose where to start</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(({ role, text, icon: I, Art }) => (
              <Link key={role} href="/login" className="feature-card">
                <Art />
                <div className="body">
                  <span className="icon-chip mb-3">
                    <I size={18} aria-hidden />
                  </span>
                  <h3 className="mb-1 text-[17px] font-semibold">{role}</h3>
                  <p className="text-[13.5px] text-dim">{text}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-amber">
                    Sign in <ArrowRight size={14} aria-hidden />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="how" className="band mt-14">
          <div className="eyebrow mb-2">Plan to plate</div>
          <h2 className="font-d mb-6 text-[30px] md:text-[38px]">Every meal, step by step.</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ title, text, Art }, i) => (
              <li key={title} className="step-card">
                <Art />
                <div className="flex gap-3 p-4">
                  <span className="step-badge">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="mb-1 text-[15px] font-semibold">{title}</h3>
                    <p className="text-[13px]">{text}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 grid items-center gap-6 md:grid-cols-[1fr_1.2fr]">
          <div className="feature-card">
            <DiningTable />
            <div className="body">
              <span className="icon-chip mb-3">
                <UtensilsCrossed size={18} aria-hidden />
              </span>
              <h3 className="mb-1 text-[17px] font-semibold">Tables that run themselves</h3>
              <p className="text-[13.5px] text-dim">Each class gets its own letter and tables (A1, A2 …). Seats, suppliers and substitutes are tracked per month.</p>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">By the numbers</div>
            <h2 className="font-d mb-6 text-[26px]">Built for real campus kitchens.</h2>
            <div className="grid grid-cols-2 gap-3">
              {STATS.map((s) => (
                <div key={s.label} className="stat">
                  <b>{s.n}</b>
                  <span className="text-[13px] text-dim">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="site-footer">
          <div className="footer-cta">
            <div>
              <div className="text-[18px] font-bold">Ready for tomorrow&apos;s lunch?</div>
              <p className="text-[13.5px]">Sign in with your campus account to see today&apos;s numbers.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}?text=${encodeURIComponent("Hi! We'd like to add our campus to DineOS.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
              >
                Add your campus on WhatsApp
              </a>
              <Link href="/login" className="btn btn-teal">
                Sign in <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[20px] font-bold tracking-tight">DineOS</div>
              <p className="muted mt-2 max-w-xs text-[13px]">Meal planning, attendance and distribution for campus canteens.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><Link href="/login">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <h4>For</h4>
              <ul className="muted">
                <li className="flex items-center gap-2"><Users size={14} aria-hidden /> Students &amp; teachers</li>
                <li className="flex items-center gap-2"><ChefHat size={14} aria-hidden /> Kitchen teams</li>
                <li className="flex items-center gap-2"><ClipboardCheck size={14} aria-hidden /> Campus admins</li>
              </ul>
            </div>
            <div>
              <h4>Trust</h4>
              <ul className="muted">
                <li className="flex items-center gap-2"><ShieldCheck size={14} aria-hidden /> Data isolated per campus</li>
                <li className="flex items-center gap-2"><Truck size={14} aria-hidden /> Table-wise delivery logs</li>
              </ul>
            </div>
          </div>
          <div className="muted mt-8 flex flex-wrap justify-between gap-2 border-t pt-4 text-[12px]" style={{ borderColor: "rgba(255,255,255,.12)" }}>
            <span>© {year} DineOS</span>
            <span>Made for KMO Islamic Academy</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

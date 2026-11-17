import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/layouts/role-shell";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Notice } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/config/env";
import { signIn } from "@/features/authentication/actions";
import type { PageProps } from "@/types/page";

export const metadata: Metadata = { title: "Sign in" };

const DEMO = [
  ["University admin", "super@campusmeal.demo"],
  ["Institution admin", "admin@campusmeal.demo"],
  ["Chef", "chef@campusmeal.demo"],
  ["Teacher", "teacher1@campusmeal.demo"],
  ["Student", "student1@campusmeal.demo"],
];

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-4 inline-block">
          <Brand sub="Sign in" />
        </Link>
        <div className="panel glass fu" style={{ padding: 26 }}>
          <h1 className="font-d mb-1 text-[26px]">Welcome back</h1>
          <p className="sub mb-5">Sign in with your institution account.</p>
          {!isSupabaseConfigured() ? (
            <Notice tone="warn">
              Supabase is not configured. See <Link href="/setup" className="underline">setup</Link>.
            </Notice>
          ) : (
            <ActionForm action={signIn}>
              <input type="hidden" name="next" value={next} />
              <Field label="Email">
                <input name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label="Password">
                <input name="password" type="password" autoComplete="current-password" required minLength={6} />
              </Field>
              <SubmitButton>Sign in</SubmitButton>
            </ActionForm>
          )}
        </div>
        <details className="panel glass disclosure mt-4">
          <summary className="text-[13px] font-semibold">Demo accounts (sample data)</summary>
          <div className="mt-3 text-[12.5px] text-dim">
            {DEMO.map(([r, e]) => (
              <div key={e} className="kv">
                <span>{r}</span>
                <span className="mono">{e}</span>
              </div>
            ))}
            <p className="mt-2">The demo password is listed in the project README.</p>
          </div>
        </details>
      </div>
    </div>
  );
}

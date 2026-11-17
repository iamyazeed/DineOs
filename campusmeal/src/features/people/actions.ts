"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, actionContext, institutionActionContext } from "@/lib/auth/guards";
import { check, parseForm, requiredText, run, uuid } from "@/lib/validations";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/utils";
import { studentLoginEmail, studentLoginId } from "@/lib/utils/login-id";
import type { ActionResult, Role } from "@/types/domain";

type Prev = ActionResult | null;
const done = () => revalidatePath("/", "layout");
const MAX_ROWS = 1000;
const password = z.string().min(6, "Password must be at least 6 characters").max(72);

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new ActionError("Creating logins needs SUPABASE_SERVICE_ROLE_KEY on the server.");
  return admin;
}
type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** Create an auth user plus a membership. Returns the new user id. */
async function createLogin(admin: AdminClient, opts: { email: string; password: string; fullName: string; role: Role; institutionId: string }) {
  const { data, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { full_name: opts.fullName },
  });
  if (error || !data.user) {
    const msg = error?.message ?? "could not create login";
    throw new ActionError(/already|registered|exists/i.test(msg) ? `${opts.email} already has a login` : msg);
  }
  const { error: mErr } = await admin.from("memberships").insert({ user_id: data.user.id, institution_id: opts.institutionId, role: opts.role });
  if (mErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new ActionError(mErr.message);
  }
  return data.user.id;
}

function readRows<T extends z.ZodTypeAny>(fd: FormData, row: T): z.infer<T>[] {
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("rows") ?? "[]"));
  } catch {
    throw new ActionError("Could not read the uploaded rows.");
  }
  if (!Array.isArray(raw) || raw.length === 0) throw new ActionError("There are no rows to import.");
  if (raw.length > MAX_ROWS) throw new ActionError(`Import at most ${MAX_ROWS} rows at a time.`);
  return raw.map((r, i) => {
    const p = row.safeParse(r);
    if (!p.success) throw new ActionError(`Row ${i + 1}: ${p.error.issues[0].path.join(".")} ${p.error.issues[0].message}`);
    return p.data;
  });
}

function summarise(created: number, noun: string, failures: string[]) {
  const head = `${created} ${noun}${created === 1 ? "" : "s"} added.`;
  if (failures.length === 0) return head;
  const shown = failures.slice(0, 5).join("; ");
  return `${head} ${failures.length} skipped — ${shown}${failures.length > 5 ? "; …" : ""}`;
}

const email = z.string().trim().toLowerCase().min(3).max(200).regex(/^[^\s@]+@[^\s@]+$/, "is not a valid email");

// ---------------------------------------------------------------------------
// Super admin → institution admins
// ---------------------------------------------------------------------------

export async function createInstitutionAdmin(_: Prev, fd: FormData) {
  return run(async () => {
    await actionContext("super_admin", "institutions.manage");
    const d = parseForm(z.object({ institution_id: uuid, full_name: requiredText(120), email, password }), fd);
    const admin = requireAdminClient();
    await createLogin(admin, { email: d.email, password: d.password, fullName: d.full_name, role: "institution_admin", institutionId: d.institution_id });
    done();
    return `${d.full_name} can now sign in as an institution admin.`;
  });
}

export async function bulkCreateInstitutionAdmins(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await actionContext("super_admin", "institutions.manage");
    const fallback = z.string().optional().parse(fd.get("default_password") ?? undefined);
    const rows = readRows(fd, z.object({ name: z.string().trim().min(1, "is empty"), email, institution: z.string().trim().min(1, "is empty"), password: z.string().optional() }));
    const { data: insts, error } = await ctx.supabase.from("institutions").select("id, code, name");
    check(error);
    const byKey = new Map<string, string>();
    for (const i of insts ?? []) {
      byKey.set(i.code.toLowerCase(), i.id);
      byKey.set(i.name.toLowerCase(), i.id);
    }
    const admin = requireAdminClient();
    let created = 0;
    const failures: string[] = [];
    for (const r of rows) {
      const instId = byKey.get(r.institution.toLowerCase());
      const pw = r.password || fallback || "";
      try {
        if (!instId) throw new ActionError(`unknown institution “${r.institution}”`);
        if (pw.length < 6) throw new ActionError("password under 6 characters");
        await createLogin(admin, { email: r.email, password: pw, fullName: r.name, role: "institution_admin", institutionId: instId });
        created++;
      } catch (e) {
        failures.push(`${r.email}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    done();
    return summarise(created, "admin", failures);
  });
}

// ---------------------------------------------------------------------------
// Institution admin → teachers, chefs, admins
// ---------------------------------------------------------------------------

const staffRole = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v.startsWith("chef") || v.startsWith("cook") || v.startsWith("kitchen") ? "chef" : v.includes("admin") ? "institution_admin" : "teacher"));

export async function bulkCreateStaff(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const fallback = z.string().optional().parse(fd.get("default_password") ?? undefined);
    const rows = readRows(fd, z.object({ name: z.string().trim().min(1, "is empty"), email, role: staffRole, password: z.string().optional() }));
    const admin = requireAdminClient();
    let created = 0;
    const failures: string[] = [];
    for (const r of rows) {
      const pw = r.password || fallback || "";
      try {
        if (pw.length < 6) throw new ActionError("password under 6 characters");
        await createLogin(admin, { email: r.email, password: pw, fullName: r.name, role: r.role as Role, institutionId: ctx.institution.id });
        created++;
      } catch (e) {
        failures.push(`${r.email}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    done();
    return summarise(created, "staff member", failures);
  });
}

// ---------------------------------------------------------------------------
// Institution admin → students
// ---------------------------------------------------------------------------

async function addStudentLogin(
  admin: AdminClient,
  inst: { id: string; code: string },
  student: { id: string; full_name: string; admission_no: number },
  pw: string,
) {
  const loginId = studentLoginId(inst.code, student.admission_no);
  const userId = await createLogin(admin, { email: studentLoginEmail(loginId), password: pw, fullName: student.full_name, role: "student", institutionId: inst.id });
  const { error } = await admin.from("students").update({ profile_id: userId }).eq("id", student.id).eq("institution_id", inst.id);
  if (error) throw new ActionError(error.message);
  return loginId;
}

export async function createStudentLogin(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const d = parseForm(z.object({ student_id: uuid, password }), fd);
    const { data: s, error } = await ctx.supabase
      .from("students")
      .select("id, full_name, admission_no, profile_id")
      .eq("id", d.student_id)
      .eq("institution_id", ctx.institution.id)
      .single();
    check(error);
    if (!s || s.profile_id) throw new ActionError("That student already has a login.");
    const loginId = await addStudentLogin(requireAdminClient(), ctx.institution, s, d.password);
    done();
    return `${s.full_name} can sign in with student ID ${loginId}.`;
  });
}

export async function bulkCreateStudents(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const inst = ctx.institution;
    const withLogins = fd.get("create_logins") === "on";
    const pw = String(fd.get("default_password") ?? "");
    if (withLogins && pw.length < 6) throw new ActionError("Set a starting password of at least 6 characters, or untick “Create logins”.");
    const rows = readRows(
      fd,
      z.object({
        name: z.string().trim().min(1, "is empty").max(120),
        class: z.string().trim().min(1, "is empty"),
        roll: z.string().trim().optional(),
        table: z.string().trim().optional(),
        dietary: z.string().trim().max(200).optional(),
      }),
    );
    const db = ctx.supabase;
    const [{ data: classes, error: cErr }, { data: tables, error: tErr }, { data: existing, error: sErr }] = await Promise.all([
      db.from("classes").select("id, name").eq("institution_id", inst.id),
      db.from("dining_tables").select("id, code").eq("institution_id", inst.id),
      db.from("students").select("class_id, roll_no").eq("institution_id", inst.id).range(0, 49999),
    ]);
    check(cErr ?? tErr ?? sErr);
    const classId = new Map((classes ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    const tableId = new Map((tables ?? []).map((t) => [t.code.toLowerCase(), t.id]));
    const usedRolls = new Map<string, Set<number>>();
    for (const s of existing ?? []) {
      if (!s.class_id) continue;
      if (!usedRolls.has(s.class_id)) usedRolls.set(s.class_id, new Set());
      usedRolls.get(s.class_id)!.add(s.roll_no);
    }
    const nextRoll = (cid: string) => {
      const used = usedRolls.get(cid) ?? new Set<number>();
      let n = 1;
      while (used.has(n)) n++;
      return n;
    };
    const admin = withLogins ? requireAdminClient() : null;
    const today = todayIn(inst.timezone);
    let created = 0;
    let logins = 0;
    const failures: string[] = [];
    for (const r of rows) {
      try {
        const cid = classId.get(r.class.toLowerCase());
        if (!cid) throw new ActionError(`unknown class “${r.class}”`);
        const roll = r.roll ? Number(r.roll) : nextRoll(cid);
        if (!Number.isInteger(roll) || roll < 1) throw new ActionError(`roll “${r.roll}” is not a number`);
        if (usedRolls.get(cid)?.has(roll)) throw new ActionError(`roll ${roll} already used in ${r.class}`);
        const tid = r.table ? tableId.get(r.table.toLowerCase()) : undefined;
        if (r.table && !tid) throw new ActionError(`unknown table “${r.table}”`);
        const { data: s, error } = await db
          .from("students")
          .insert({ institution_id: inst.id, class_id: cid, roll_no: roll, full_name: r.name, dietary_notes: r.dietary || null })
          .select("id, full_name, admission_no")
          .single();
        if (error || !s) throw new ActionError(error?.message ?? "insert failed");
        if (!usedRolls.has(cid)) usedRolls.set(cid, new Set());
        usedRolls.get(cid)!.add(roll);
        created++;
        if (tid) {
          const { error: aErr } = await db.from("table_assignments").insert({ institution_id: inst.id, table_id: tid, student_id: s.id, start_date: today });
          if (aErr) failures.push(`${r.name}: added, but not seated (${aErr.message})`);
        }
        if (admin) {
          try {
            await addStudentLogin(admin, inst, s, pw);
            logins++;
          } catch (e) {
            failures.push(`${r.name}: added, but no login (${e instanceof Error ? e.message : "failed"})`);
          }
        }
      } catch (e) {
        failures.push(`${r.name || "row"}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    done();
    const base = summarise(created, "student", failures);
    return withLogins ? base.replace(" added.", ` added, ${logins} with logins.`) : base;
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, institutionActionContext } from "@/lib/auth/guards";
import { check, isoDate, optionalText, parseForm, requiredText, run, time, uuid } from "@/lib/validations";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/utils";
import type { ActionResult } from "@/types/domain";

type Prev = ActionResult | null;
const done = () => revalidatePath("/", "layout");

export async function updateInstitutionDefaults(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "institution.configure");
    const d = parseForm(
      z.object({
        name: requiredText(120),
        timezone: requiredText(60),
        default_table_capacity: z.coerce.number().int().min(1).max(100),
        default_cancel_days_before: z.coerce.number().int().min(0).max(7),
        default_cancel_time: time,
        supplier_rotation_days: z.coerce.number().int().min(1).max(120),
        apply_to_schedules: z.string().optional(),
      }),
      fd,
    );
    try {
      new Intl.DateTimeFormat("en", { timeZone: d.timezone });
    } catch {
      throw new ActionError("Unknown timezone. Use an IANA name such as Australia/Sydney.");
    }
    const { apply_to_schedules, ...values } = d;
    const { error } = await ctx.supabase.from("institutions").update(values).eq("id", ctx.institution.id);
    check(error);
    if (apply_to_schedules) {
      const { error: e2 } = await ctx.supabase
        .from("meal_schedules")
        .update({ cancel_days_before: d.default_cancel_days_before, cancel_time: d.default_cancel_time })
        .eq("institution_id", ctx.institution.id);
      check(e2);
    }
    done();
    return "Campus defaults saved. They apply every day until you change them.";
  });
}

export async function createHall(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "halls.manage");
    const d = parseForm(z.object({ name: requiredText(80), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "1–6 letters/digits") }), fd);
    const { count } = await ctx.supabase.from("dining_halls").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institution.id);
    const { error } = await ctx.supabase.from("dining_halls").insert({ ...d, institution_id: ctx.institution.id, sort_order: (count ?? 0) + 1 });
    check(error, "A hall with this code already exists.");
    done();
    return `Hall ${d.code} created.`;
  });
}

export async function setHallActive(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "halls.manage");
    const d = parseForm(z.object({ hall_id: uuid, active: z.enum(["true", "false"]) }), fd);
    const { error } = await ctx.supabase.from("dining_halls").update({ active: d.active === "true" }).eq("id", d.hall_id).eq("institution_id", ctx.institution.id);
    check(error);
    done();
    return d.active === "true" ? "Hall reopened." : "Hall closed. Its students are excluded from meal counts until reopened.";
  });
}

export async function createTables(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "halls.manage");
    const d = parseForm(
      z.object({
        hall_id: uuid,
        count: z.coerce.number().int().min(1).max(100),
        capacity: z.string().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().int().min(1).max(100).nullable()),
      }),
      fd,
    );
    const { data: hall } = await ctx.supabase.from("dining_halls").select("code").eq("id", d.hall_id).eq("institution_id", ctx.institution.id).single();
    if (!hall) throw new ActionError("Hall not found.");
    const { data: existing } = await ctx.supabase.from("dining_tables").select("code").eq("institution_id", ctx.institution.id);
    const used = new Set((existing ?? []).map((t) => t.code));
    const rows = [];
    for (let n = 1; rows.length < d.count && n < 1000; n++) {
      const code = `${hall.code}${String(n).padStart(2, "0")}`;
      if (!used.has(code)) rows.push({ institution_id: ctx.institution.id, hall_id: d.hall_id, code, capacity: d.capacity });
    }
    const { error } = await ctx.supabase.from("dining_tables").insert(rows);
    check(error);
    done();
    return `Added ${rows.length} table(s): ${rows[0]?.code} – ${rows[rows.length - 1]?.code}.`;
  });
}

export async function updateTable(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "halls.manage");
    const d = parseForm(
      z.object({
        table_id: uuid,
        capacity: z.string().optional().transform((v) => (v ? Number(v) : null)).pipe(z.number().int().min(1).max(100).nullable()),
        active: z.enum(["true", "false"]),
      }),
      fd,
    );
    const { error } = await ctx.supabase
      .from("dining_tables")
      .update({ capacity: d.capacity, active: d.active === "true" })
      .eq("id", d.table_id)
      .eq("institution_id", ctx.institution.id);
    check(error);
    done();
    return "Table updated.";
  });
}

/** Change a student's fixed table. The previous assignment is ended, not deleted. */
export async function assignTable(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "halls.manage");
    const d = parseForm(z.object({ student_id: uuid, table_id: uuid }), fd);
    const db = ctx.supabase;
    const [{ data: table }, { count }] = await Promise.all([
      db.from("dining_tables").select("code, capacity").eq("id", d.table_id).eq("institution_id", ctx.institution.id).single(),
      db.from("table_assignments").select("id", { count: "exact", head: true }).eq("table_id", d.table_id).is("end_date", null),
    ]);
    if (!table) throw new ActionError("Table not found.");
    const cap = table.capacity ?? ctx.institution.default_table_capacity;
    if ((count ?? 0) >= cap) throw new ActionError(`Table ${table.code} is full (${cap} seats).`);
    const today = todayIn(ctx.institution.timezone);
    const { error: endErr } = await db.from("table_assignments").update({ end_date: today }).eq("student_id", d.student_id).is("end_date", null);
    check(endErr);
    const { error } = await db.from("table_assignments").insert({ institution_id: ctx.institution.id, table_id: d.table_id, student_id: d.student_id, start_date: today });
    check(error);
    done();
    return `Student moved to ${table.code}. Previous assignment kept in history.`;
  });
}

export async function createClass(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const d = parseForm(z.object({ name: requiredText(80), teacher_id: z.string().optional().transform((v) => v || null) }), fd);
    const { error } = await ctx.supabase.from("classes").insert({ institution_id: ctx.institution.id, name: d.name, teacher_id: d.teacher_id });
    check(error, "A class with this name already exists.");
    done();
    return `Class "${d.name}" created.`;
  });
}

export async function setClassTeacher(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const d = parseForm(z.object({ class_id: uuid, teacher_id: z.string().optional().transform((v) => v || null) }), fd);
    const { error } = await ctx.supabase.from("classes").update({ teacher_id: d.teacher_id }).eq("id", d.class_id).eq("institution_id", ctx.institution.id);
    check(error);
    done();
    return "Class teacher updated.";
  });
}

export async function createStudent(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const d = parseForm(
      z.object({
        full_name: requiredText(120),
        class_id: uuid,
        roll_no: z.coerce.number().int().min(1).max(9999),
        dietary_notes: optionalText(200),
        table_id: z.string().optional().transform((v) => v || null),
      }),
      fd,
    );
    const { table_id, ...student } = d;
    const { data, error } = await ctx.supabase
      .from("students")
      .insert({ ...student, institution_id: ctx.institution.id })
      .select("id")
      .single();
    check(error, "That roll number is already used in this class.");
    if (table_id && data) {
      const { error: e2 } = await ctx.supabase
        .from("table_assignments")
        .insert({ institution_id: ctx.institution.id, table_id, student_id: data.id, start_date: todayIn(ctx.institution.timezone) });
      check(e2);
    }
    done();
    return `${d.full_name} registered.`;
  });
}

export async function setStudentActive(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const d = parseForm(z.object({ student_id: uuid, active: z.enum(["true", "false"]) }), fd);
    const { error } = await ctx.supabase.from("students").update({ active: d.active === "true" }).eq("id", d.student_id).eq("institution_id", ctx.institution.id);
    check(error);
    done();
    return "Student updated.";
  });
}

/** Create a login (teacher, chef or student). Requires the server-only service-role key. */
export async function createAccount(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "students.manage");
    const d = parseForm(
      z.object({
        email: z.string().trim().toLowerCase().email(),
        full_name: requiredText(120),
        role: z.enum(["teacher", "chef", "student"]),
        password: z.string().min(8, "At least 8 characters"),
        student_id: z.string().optional().transform((v) => v || null),
      }),
      fd,
    );
    if (d.role === "student" && !d.student_id) throw new ActionError("Choose the student record this login belongs to.");
    const admin = createAdminClient();
    if (!admin) throw new ActionError("Account creation needs SUPABASE_SERVICE_ROLE_KEY on the server. Ask your platform operator to configure it.");
    const { data, error } = await admin.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
      user_metadata: { full_name: d.full_name },
    });
    if (error || !data.user) throw new ActionError(error?.message ?? "Could not create user.");
    const { error: mErr } = await admin.from("memberships").insert({ user_id: data.user.id, institution_id: ctx.institution.id, role: d.role });
    check(mErr);
    if (d.student_id) {
      const { error: sErr } = await admin.from("students").update({ profile_id: data.user.id }).eq("id", d.student_id).eq("institution_id", ctx.institution.id);
      check(sErr);
    }
    done();
    return `Login created for ${d.full_name} (${d.role}). Share the temporary password securely.`;
  });
}

export async function upsertSchedule(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "timetable.manage");
    const d = parseForm(
      z.object({
        id: z.string().optional().transform((v) => v || null),
        name: requiredText(60),
        serve_time: time,
        cancel_days_before: z.coerce.number().int().min(0).max(7),
        cancel_time: time,
        "weekdays[]": z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day").or(z.coerce.number().transform((n) => [n])),
        "hall_ids[]": z.array(uuid).or(uuid.transform((v) => [v])).optional(),
      }),
      fd,
    );
    const halls = d["hall_ids[]"] ?? [];
    const row = {
      institution_id: ctx.institution.id,
      name: d.name,
      serve_time: d.serve_time,
      cancel_days_before: d.cancel_days_before,
      cancel_time: d.cancel_time,
      weekdays: d["weekdays[]"],
      hall_ids: halls.length ? halls : null,
    };
    const q = d.id
      ? ctx.supabase.from("meal_schedules").update(row).eq("id", d.id).eq("institution_id", ctx.institution.id)
      : ctx.supabase.from("meal_schedules").insert({ ...row, sort_order: 99 });
    const { error } = await q;
    check(error, "A meal with this name already exists.");
    done();
    return d.id ? `${d.name} updated. Future days follow the new timetable.` : `${d.name} added to the standing timetable.`;
  });
}

export async function setScheduleActive(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "timetable.manage");
    const d = parseForm(z.object({ id: uuid, active: z.enum(["true", "false"]) }), fd);
    const { error } = await ctx.supabase.from("meal_schedules").update({ active: d.active === "true" }).eq("id", d.id).eq("institution_id", ctx.institution.id);
    check(error);
    done();
    return d.active === "true" ? "Meal re-enabled for future days." : "Meal paused for future days. Existing records are preserved.";
  });
}

export async function saveMenu(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "menu.publish");
    const d = parseForm(z.object({ schedule_id: uuid, weekday: z.coerce.number().int().min(0).max(6), items: z.string().trim().max(400) }), fd);
    const { error } = await ctx.supabase
      .from("meal_menus")
      .upsert({ ...d, institution_id: ctx.institution.id, updated_at: new Date().toISOString() }, { onConflict: "schedule_id,weekday" });
    check(error);
    done();
    return "Menu published.";
  });
}

/** Daily exception: cancel, sponsor, modify menu or restore a single meal. Never deletes. */
export async function overrideMeal(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "meal.override");
    const d = parseForm(
      z.object({
        meal_id: uuid,
        action: z.enum(["cancelled", "sponsored", "modified", "scheduled"]),
        reason: optionalText(300),
        menu_override: optionalText(400),
        notify: z.string().optional(),
      }),
      fd,
    );
    if (d.action !== "scheduled" && !d.reason) throw new ActionError("Please give a reason so everyone understands the change.");
    if (d.action === "modified" && !d.menu_override) throw new ActionError("Enter the modified menu.");
    const { data: meal } = await ctx.supabase
      .from("meals")
      .select("id, meal_date, schedule:meal_schedules(name)")
      .eq("id", d.meal_id)
      .eq("institution_id", ctx.institution.id)
      .single();
    if (!meal) throw new ActionError("Meal not found.");
    const { error } = await ctx.supabase
      .from("meals")
      .update({
        status: d.action,
        status_reason: d.action === "scheduled" ? null : d.reason,
        menu_override: d.action === "modified" || d.action === "sponsored" ? d.menu_override : null,
      })
      .eq("id", d.meal_id);
    check(error);
    const name = (Array.isArray(meal.schedule) ? meal.schedule[0] : (meal.schedule as { name: string } | null))?.name ?? "Meal";
    if (d.notify) {
      const titles = {
        cancelled: `${name} on ${meal.meal_date} is cancelled`,
        sponsored: `${name} on ${meal.meal_date} is a sponsored meal`,
        modified: `${name} menu changed for ${meal.meal_date}`,
        scheduled: `${name} on ${meal.meal_date} is back to normal`,
      };
      const kind = { cancelled: "cancellation", sponsored: "sponsored", modified: "menu_change", scheduled: "general" }[d.action];
      const { error: aErr } = await ctx.supabase.from("announcements").insert({
        institution_id: ctx.institution.id,
        title: titles[d.action],
        body: [d.reason, d.menu_override ? `Menu: ${d.menu_override}` : null].filter(Boolean).join("\n"),
        kind,
        audience: ["student", "teacher", "chef"],
        meal_id: d.meal_id,
        created_by: ctx.userId,
      });
      check(aErr);
    }
    done();
    return `${name} updated${d.notify ? " and students, teachers and kitchen notified" : ""}.`;
  });
}

export async function ensureDate(_: Prev, fd: FormData) {
  return run(async () => {
    const ctx = await institutionActionContext("institution_admin", "meal.override");
    const d = parseForm(z.object({ date: isoDate }), fd);
    const { error } = await ctx.supabase.rpc("ensure_meals", { inst: ctx.institution.id, p_date: d.date });
    check(error);
    done();
    return "Meals generated from the timetable.";
  });
}

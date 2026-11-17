import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateMeal, type CalcSeat, type CalcStudent, type MealBreakdown, type CalcSeparateRequest } from "@/features/meals/calc";
import { cancelDeadline, isValidDate, todayIn, weekday } from "@/lib/utils";
import type { Institution, MealStatus, PrepStatus } from "@/types/domain";

export interface Schedule {
  id: string;
  name: string;
  serve_time: string;
  weekdays: number[];
  hall_ids: string[] | null;
  cancel_days_before: number;
  cancel_time: string;
  active: boolean;
  sort_order: number;
}

export interface Prep {
  status: PrepStatus;
  progress: number;
  delay_minutes: number | null;
  delay_reason: string | null;
  updated_at: string;
}

export interface DayMeal {
  id: string;
  meal_date: string;
  status: MealStatus;
  status_reason: string | null;
  menu_override: string | null;
  menu: string;
  schedule: Schedule;
  prep: Prep | null;
  /** Institution-local "YYYY-MM-DDTHH:MM" */
  deadline: string;
}

type DB = SupabaseClient;

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const MEAL_SELECT =
  "id, meal_date, status, status_reason, menu_override, schedule:meal_schedules!inner(id, name, serve_time, weekdays, hall_ids, cancel_days_before, cancel_time, active, sort_order), prep:preparation_tasks(status, progress, delay_minutes, delay_reason, updated_at)";

async function attachMenus(db: DB, instId: string, rows: Record<string, unknown>[]): Promise<DayMeal[]> {
  const { data: menus } = await db.from("meal_menus").select("schedule_id, weekday, items").eq("institution_id", instId);
  const menuMap = new Map((menus ?? []).map((m) => [`${m.schedule_id}:${m.weekday}`, m.items as string]));
  return rows
    .map((r) => {
      const schedule = one(r.schedule as Schedule | Schedule[])!;
      const date = r.meal_date as string;
      return {
        id: r.id as string,
        meal_date: date,
        status: r.status as MealStatus,
        status_reason: (r.status_reason as string) ?? null,
        menu_override: (r.menu_override as string) ?? null,
        menu: (r.menu_override as string) || menuMap.get(`${schedule.id}:${weekday(date)}`) || "",
        schedule,
        prep: one(r.prep as Prep | Prep[] | null),
        deadline: cancelDeadline(date, schedule.cancel_days_before, schedule.cancel_time),
      };
    })
    .sort((a, b) => a.meal_date.localeCompare(b.meal_date) || a.schedule.serve_time.localeCompare(b.schedule.serve_time));
}

/** Meals for a date, generated from the standing timetable if missing. */
export const getDayMeals = cache(async (db: DB, inst: Institution, date: string): Promise<DayMeal[]> => {
  await db.rpc("ensure_meals", { inst: inst.id, p_date: date });
  const { data, error } = await db.from("meals").select(MEAL_SELECT).eq("institution_id", inst.id).eq("meal_date", date);
  if (error) throw new Error(error.message);
  return attachMenus(db, inst.id, data ?? []);
});

/** Meals over a date range (ensures each day exists). */
export async function getMealsInRange(db: DB, inst: Institution, from: string, days: number): Promise<DayMeal[]> {
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  await Promise.all(dates.map((d) => db.rpc("ensure_meals", { inst: inst.id, p_date: d })));
  const { data, error } = await db
    .from("meals")
    .select(MEAL_SELECT)
    .eq("institution_id", inst.id)
    .gte("meal_date", dates[0])
    .lte("meal_date", dates[dates.length - 1]);
  if (error) throw new Error(error.message);
  return attachMenus(db, inst.id, data ?? []);
}

export interface CampusStructure {
  students: CalcStudent[];
  seats: CalcSeat[];
  classes: Array<{ id: string; name: string; teacher_id: string | null }>;
  halls: Array<{ id: string; name: string; code: string; active: boolean }>;
}

/** Students, classes, halls and active seat assignments (staff only via RLS). */
export const getCampusStructure = cache(async (db: DB, inst: Institution): Promise<CampusStructure> => {
  const [classesRes, studentsRes, seatsRes, hallsRes] = await Promise.all([
    db.from("classes").select("id, name, teacher_id").eq("institution_id", inst.id).order("name"),
    db.from("students").select("id, full_name, roll_no, class_id, active").eq("institution_id", inst.id).range(0, 9999),
    db
      .from("table_assignments")
      .select("student_id, table:dining_tables!inner(id, code, capacity, active, hall:dining_halls!inner(id, name, active))")
      .eq("institution_id", inst.id)
      .is("end_date", null)
      .range(0, 9999),
    db.from("dining_halls").select("id, name, code, active").eq("institution_id", inst.id).order("sort_order"),
  ]);
  const classes = classesRes.data ?? [];
  const className = new Map(classes.map((c) => [c.id, c.name as string]));
  const students: CalcStudent[] = (studentsRes.data ?? []).map((s) => ({
    id: s.id,
    full_name: s.full_name,
    roll_no: s.roll_no,
    class_id: s.class_id,
    class_name: s.class_id ? className.get(s.class_id) ?? "" : "Unassigned",
    active: s.active,
  }));
  const seats: CalcSeat[] = (seatsRes.data ?? []).map((a) => {
    type H = { id: string; name: string; active: boolean };
    type T = { id: string; code: string; capacity: number | null; active: boolean; hall: H | H[] };
    const t = one(a.table as unknown as T | T[])!;
    const h = one(t.hall)!;
    return {
      student_id: a.student_id,
      table_id: t.id as string,
      table_code: t.code as string,
      capacity: (t.capacity as number | null) ?? inst.default_table_capacity,
      table_active: t.active as boolean,
      hall_id: h.id as string,
      hall_name: h.name as string,
      hall_active: h.active as boolean,
    };
  });
  return { students, seats, classes, halls: hallsRes.data ?? [] };
});

export interface SeparateRequestRow extends CalcSeparateRequest {
  class_id: string;
  class_name: string;
  meal_id: string;
  requirement: string;
  dietary_info: string | null;
  reason: string | null;
  review_note: string | null;
  created_at: string;
}

export async function getSeparateRequests(db: DB, instId: string, mealIds: string[]): Promise<SeparateRequestRow[]> {
  if (mealIds.length === 0) return [];
  const { data } = await db
    .from("separate_food_requests")
    .select("id, status, portions, class_id, meal_id, requirement, dietary_info, reason, review_note, created_at, class:classes(name), students:separate_food_request_students(student_id)")
    .eq("institution_id", instId)
    .in("meal_id", mealIds)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    portions: r.portions,
    class_id: r.class_id,
    class_name: one(r.class as unknown as { name: string })?.name ?? "",
    meal_id: r.meal_id,
    requirement: r.requirement,
    dietary_info: r.dietary_info,
    reason: r.reason,
    review_note: r.review_note,
    created_at: r.created_at,
    student_ids: ((r.students as Array<{ student_id: string }>) ?? []).map((s) => s.student_id),
  }));
}

/** Full calculated breakdown for one meal. */
export const getMealBreakdown = cache(async (db: DB, inst: Institution, meal: DayMeal): Promise<MealBreakdown> => {
  const [structure, canc, abs, reqs] = await Promise.all([
    getCampusStructure(db, inst),
    db.from("meal_cancellations").select("student_id").eq("meal_id", meal.id).range(0, 9999),
    db.from("meal_attendance").select("student_id").eq("meal_id", meal.id).range(0, 9999),
    getSeparateRequests(db, inst.id, [meal.id]),
  ]);
  return calculateMeal({
    mealStatus: meal.status,
    hallIds: meal.schedule.hall_ids,
    students: structure.students,
    seats: structure.seats,
    cancelledIds: (canc.data ?? []).map((r) => r.student_id),
    absentIds: (abs.data ?? []).map((r) => r.student_id),
    separateRequests: reqs,
  });
});

/** Resolve ?date=&meal= search params to a date, its meals and a selected meal. */
export async function resolveMealSelection(
  db: DB,
  inst: Institution,
  params: { date?: string | string[]; meal?: string | string[] },
) {
  const today = todayIn(inst.timezone);
  const date = isValidDate(params.date) ? params.date : today;
  const meals = await getDayMeals(db, inst, date);
  const wanted = typeof params.meal === "string" ? params.meal : undefined;
  // Default to the next meal still to be served today, else the first.
  const nowHHMM = new Intl.DateTimeFormat("en-GB", { timeZone: inst.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const upcoming = date === today ? meals.find((m) => m.schedule.serve_time.slice(0, 5) >= nowHHMM && m.status !== "cancelled") : undefined;
  const selected = meals.find((m) => m.id === wanted) ?? upcoming ?? meals[0] ?? null;
  return { today, date, meals, selected };
}

export async function getMealTotals(db: DB, from: string, to: string, instId?: string) {
  const { data, error } = await db.rpc("meal_totals", { p_from: from, p_to: to, p_inst: instId ?? null });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    institution_id: string;
    meal_id: string;
    meal_date: string;
    meal_name: string;
    meal_status: MealStatus;
    eligible: number;
    cancelled: number;
    absent: number;
    excluded: number;
    separate_portions: number;
    regular: number;
  }>;
}

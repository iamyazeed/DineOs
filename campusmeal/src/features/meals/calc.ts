/**
 * Meal requirement calculation — the single in-app source of truth for counts.
 * Mirrors public.meal_totals() in SQL (used for multi-day analytics).
 *
 *   eligible  = active students seated at an active table in an active hall
 *               that the meal applies to
 *   excluded  = DISTINCT(student cancellations ∪ teacher-reported absences)
 *   separate  = eligible, not excluded, on an APPROVED separate-food request
 *   regular   = eligible − excluded − separate
 *   separatePortions = Σ approved request portions (reported separately)
 */

export interface CalcStudent {
  id: string;
  full_name: string;
  roll_no: number;
  class_id: string | null;
  class_name: string;
  active: boolean;
}

export interface CalcSeat {
  student_id: string;
  table_id: string;
  table_code: string;
  hall_id: string;
  hall_name: string;
  hall_active: boolean;
  table_active: boolean;
  capacity: number;
}

export interface CalcSeparateRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  portions: number;
  student_ids: string[];
}

export interface CalcInput {
  mealStatus: "scheduled" | "modified" | "sponsored" | "cancelled";
  hallIds: string[] | null;
  students: CalcStudent[];
  seats: CalcSeat[];
  cancelledIds: string[];
  absentIds: string[];
  separateRequests: CalcSeparateRequest[];
}

export type StudentMealState = "regular" | "separate" | "cancelled" | "absent";

export interface Bucket {
  key: string;
  label: string;
  assigned: number;
  excluded: number;
  separate: number;
  regular: number;
}

export interface TableBucket extends Bucket {
  hall_id: string;
  hall_name: string;
  capacity: number;
  students: Array<{ id: string; full_name: string; roll_no: number; class_name: string; state: StudentMealState }>;
}

export interface MealBreakdown {
  active: boolean;
  eligible: number;
  cancelled: number;
  absent: number;
  excluded: number;
  separateStudents: number;
  separatePortions: number;
  regular: number;
  pendingSeparateRequests: number;
  byHall: Bucket[];
  byTable: TableBucket[];
  byClass: Bucket[];
}

function bucket(key: string, label: string): Bucket {
  return { key, label, assigned: 0, excluded: 0, separate: 0, regular: 0 };
}

export function calculateMeal(input: CalcInput): MealBreakdown {
  const active = input.mealStatus !== "cancelled";
  const studentsById = new Map(input.students.map((s) => [s.id, s]));
  const cancelled = new Set(input.cancelledIds);
  const absent = new Set(input.absentIds);
  const approved = input.separateRequests.filter((r) => r.status === "approved");
  const separateSet = new Set(approved.flatMap((r) => r.student_ids));

  const byHall = new Map<string, Bucket>();
  const byTable = new Map<string, TableBucket>();
  const byClass = new Map<string, Bucket>();

  let eligible = 0;
  let nCancelled = 0;
  let nAbsent = 0;
  let nExcluded = 0;
  let nSeparate = 0;
  const seen = new Set<string>(); // never count a student twice

  for (const seat of input.seats) {
    const st = studentsById.get(seat.student_id);
    if (!st || !st.active || seen.has(st.id)) continue;
    if (!seat.hall_active || !seat.table_active) continue;
    if (input.hallIds && !input.hallIds.includes(seat.hall_id)) continue;
    seen.add(st.id);
    eligible++;

    let state: StudentMealState = "regular";
    if (cancelled.has(st.id)) state = "cancelled";
    else if (absent.has(st.id)) state = "absent";
    else if (separateSet.has(st.id)) state = "separate";

    if (state === "cancelled") nCancelled++;
    if (state === "absent") nAbsent++;
    if (cancelled.has(st.id) || absent.has(st.id)) nExcluded++;
    if (state === "separate") nSeparate++;

    const hall = byHall.get(seat.hall_id) ?? bucket(seat.hall_id, seat.hall_name);
    const cls = byClass.get(st.class_id ?? "none") ?? bucket(st.class_id ?? "none", st.class_name || "Unassigned");
    const table =
      byTable.get(seat.table_id) ??
      ({ ...bucket(seat.table_id, seat.table_code), hall_id: seat.hall_id, hall_name: seat.hall_name, capacity: seat.capacity, students: [] } as TableBucket);
    for (const b of [hall, cls, table]) {
      b.assigned++;
      if (state === "cancelled" || state === "absent") b.excluded++;
      else if (state === "separate") b.separate++;
      else b.regular++;
    }
    table.students.push({ id: st.id, full_name: st.full_name, roll_no: st.roll_no, class_name: st.class_name, state });
    byHall.set(seat.hall_id, hall);
    byClass.set(cls.key, cls);
    byTable.set(seat.table_id, table);
  }

  const regular = eligible - nExcluded - nSeparate;
  const separatePortions = approved.reduce((sum, r) => sum + r.portions, 0);
  const sortLabel = <T extends Bucket>(a: T, b: T) => a.label.localeCompare(b.label, undefined, { numeric: true });

  if (!active) {
    // Preserve the record but nothing should be prepared.
    const zero = <T extends Bucket>(b: T): T => ({ ...b, regular: 0, separate: 0 });
    return {
      active, eligible, cancelled: nCancelled, absent: nAbsent, excluded: nExcluded,
      separateStudents: 0, separatePortions: 0, regular: 0,
      pendingSeparateRequests: input.separateRequests.filter((r) => r.status === "pending").length,
      byHall: [...byHall.values()].map(zero).sort(sortLabel),
      byTable: [...byTable.values()].map(zero).sort(sortLabel),
      byClass: [...byClass.values()].map(zero).sort(sortLabel),
    };
  }

  for (const t of byTable.values()) t.students.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.roll_no - b.roll_no);

  return {
    active,
    eligible,
    cancelled: nCancelled,
    absent: nAbsent,
    excluded: nExcluded,
    separateStudents: nSeparate,
    separatePortions,
    regular,
    pendingSeparateRequests: input.separateRequests.filter((r) => r.status === "pending").length,
    byHall: [...byHall.values()].sort(sortLabel),
    byTable: [...byTable.values()].sort(sortLabel),
    byClass: [...byClass.values()].sort(sortLabel),
  };
}

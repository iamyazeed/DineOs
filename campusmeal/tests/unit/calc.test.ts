import { describe, expect, it } from "vitest";
import { calculateMeal, type CalcInput } from "@/features/meals/calc";
import { can, canOpenPath } from "@/lib/auth/permissions";
import { cancelDeadline, addDays, nowLocalIn } from "@/lib/utils";

function makeInput(over: Partial<CalcInput> = {}): CalcInput {
  const students = Array.from({ length: 12 }, (_, i) => ({
    id: `s${i + 1}`,
    full_name: `Student ${i + 1}`,
    roll_no: i + 1,
    class_id: i < 6 ? "c1" : "c2",
    class_name: i < 6 ? "Class 1" : "Class 2",
    active: true,
  }));
  const seats = students.map((s, i) => ({
    student_id: s.id,
    table_id: i < 7 ? "t1" : "t2",
    table_code: i < 7 ? "A01" : "B01",
    hall_id: i < 7 ? "h1" : "h2",
    hall_name: i < 7 ? "Hall A" : "Hall B",
    hall_active: true,
    table_active: true,
    capacity: 10,
  }));
  return { mealStatus: "scheduled", hallIds: null, students, seats, cancelledIds: [], absentIds: [], separateRequests: [], ...over };
}

describe("calculateMeal", () => {
  it("counts every seated active student as regular by default", () => {
    const r = calculateMeal(makeInput());
    expect(r.eligible).toBe(12);
    expect(r.regular).toBe(12);
    expect(r.byHall.map((h) => h.regular)).toEqual([7, 5]);
  });

  it("never double-counts a student who cancelled AND was reported absent", () => {
    const r = calculateMeal(makeInput({ cancelledIds: ["s1", "s2"], absentIds: ["s2", "s3"] }));
    expect(r.excluded).toBe(3);
    expect(r.regular).toBe(9);
    expect(r.cancelled).toBe(2);
    expect(r.absent).toBe(1); // s2 is attributed to the cancellation
  });

  it("ignores duplicate cancellation ids", () => {
    const r = calculateMeal(makeInput({ cancelledIds: ["s1", "s1", "s1"] }));
    expect(r.excluded).toBe(1);
    expect(r.regular).toBe(11);
  });

  it("keeps separate food apart from regular and only counts approved requests", () => {
    const r = calculateMeal(
      makeInput({
        absentIds: ["s4"],
        separateRequests: [
          { id: "r1", status: "approved", portions: 3, student_ids: ["s4", "s5", "s6"] },
          { id: "r2", status: "pending", portions: 2, student_ids: ["s7", "s8"] },
        ],
      }),
    );
    expect(r.separateStudents).toBe(2); // s4 is absent
    expect(r.separatePortions).toBe(3);
    expect(r.regular).toBe(12 - 1 - 2);
    expect(r.pendingSeparateRequests).toBe(1);
    expect(r.regular + r.separateStudents + r.excluded).toBe(r.eligible);
  });

  it("respects hall applicability and inactive halls", () => {
    const r = calculateMeal(makeInput({ hallIds: ["h2"] }));
    expect(r.eligible).toBe(5);
    const input = makeInput();
    input.seats = input.seats.map((s) => (s.hall_id === "h1" ? { ...s, hall_active: false } : s));
    expect(calculateMeal(input).eligible).toBe(5);
  });

  it("produces zero portions for a cancelled meal while preserving counts", () => {
    const r = calculateMeal(makeInput({ mealStatus: "cancelled", cancelledIds: ["s1"] }));
    expect(r.active).toBe(false);
    expect(r.regular).toBe(0);
    expect(r.eligible).toBe(12);
  });

  it("table and class totals add up to the meal totals", () => {
    const r = calculateMeal(makeInput({ cancelledIds: ["s1", "s9"] }));
    const sum = (k: "regular" | "excluded") => r.byTable.reduce((a, t) => a + t[k], 0);
    expect(sum("regular")).toBe(r.regular);
    expect(sum("excluded")).toBe(r.excluded);
    expect(r.byClass.reduce((a, c) => a + c.regular, 0)).toBe(r.regular);
  });
});

describe("permissions", () => {
  it("teachers cannot change institution settings or kitchen preparation", () => {
    expect(can("teacher", "institution.configure")).toBe(false);
    expect(can("teacher", "prep.update")).toBe(false);
    expect(can("teacher", "menu.publish")).toBe(false);
    expect(can("teacher", "distribution.teacher")).toBe(true);
  });
  it("chefs cannot modify attendance or supplier rotation", () => {
    expect(can("chef", "attendance.report")).toBe(false);
    expect(can("chef", "supplier.manage")).toBe(false);
    expect(can("chef", "prep.update")).toBe(true);
  });
  it("supplier rotation belongs to teachers, not admins", () => {
    expect(can("institution_admin", "supplier.manage")).toBe(false);
  });
  it("students cannot open administrative dashboards", () => {
    expect(canOpenPath(["student"], "/admin")).toBe(false);
    expect(canOpenPath(["student"], "/super-admin/institutions")).toBe(false);
    expect(canOpenPath(["student"], "/student/menu")).toBe(true);
    expect(canOpenPath(["institution_admin"], "/administrator")).toBe(false);
  });
});

describe("cancellation deadline", () => {
  it("defaults to the previous day at the configured time", () => {
    expect(cancelDeadline("2026-11-18", 1, "20:00:00")).toBe("2026-11-17T20:00");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("compares institution-local wall clock times", () => {
    const deadline = cancelDeadline("2026-11-18", 1, "20:00");
    const before = nowLocalIn("UTC", new Date("2026-11-17T19:59:00Z"));
    const after = nowLocalIn("UTC", new Date("2026-11-17T20:00:00Z"));
    expect(before < deadline).toBe(true);
    expect(after < deadline).toBe(false);
  });
});

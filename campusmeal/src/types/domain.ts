export type Role = "super_admin" | "institution_admin" | "chef" | "teacher" | "student";
export type PrepStatus = "not_started" | "in_progress" | "completed" | "delayed";
export type MealStatus = "scheduled" | "modified" | "sponsored" | "cancelled";

export interface Institution {
  id: string;
  name: string;
  code: string;
  timezone: string;
  default_table_capacity: number;
  default_cancel_days_before: number;
  default_cancel_time: string;
  supplier_rotation_days: number;
  active: boolean;
  is_demo: boolean;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

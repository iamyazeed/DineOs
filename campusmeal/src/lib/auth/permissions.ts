import type { Role } from "@/types/domain";

/**
 * Application-level permission matrix. This mirrors (and never replaces) the
 * Row Level Security policies in supabase/migrations — the database is the
 * final authority; these checks give fast, friendly errors in server actions.
 */
export const PERMISSIONS = {
  "institution.configure": ["institution_admin"],
  "halls.manage": ["institution_admin"],
  "students.manage": ["institution_admin"],
  "timetable.manage": ["institution_admin"],
  "menu.publish": ["institution_admin"],
  "meal.override": ["institution_admin"],
  "announcement.publish": ["institution_admin"],
  "separateFood.review": ["institution_admin"],
  "serviceRequest.review": ["institution_admin"],
  "university.message": ["institution_admin", "super_admin"],
  "meal.cancelOwn": ["student"],
  "meal.lateException": ["teacher", "institution_admin"],
  "attendance.report": ["teacher", "institution_admin"],
  "separateFood.request": ["teacher"],
  "supplier.manage": ["teacher"],
  "distribution.teacher": ["teacher"],
  "missingMeal.report": ["teacher"],
  "prep.update": ["chef"],
  "delivery.update": ["chef"],
  "ingredients.record": ["chef"],
  "serviceRequest.create": ["chef"],
  "missingMeal.resolve": ["chef", "institution_admin"],
  "institutions.manage": ["super_admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Which URL prefix each role may open. */
export const ROLE_PREFIX: Record<Role, string> = {
  super_admin: "/super-admin",
  institution_admin: "/admin",
  chef: "/chef",
  teacher: "/teacher",
  student: "/student",
};

export function canOpenPath(roles: Role[], path: string): boolean {
  return roles.some((r) => path === ROLE_PREFIX[r] || path.startsWith(ROLE_PREFIX[r] + "/"));
}

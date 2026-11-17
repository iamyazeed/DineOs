import type { Role } from "@/types/domain";

export const ROLE_HOME: Record<Role, string> = {
  super_admin: "/super-admin",
  institution_admin: "/admin",
  chef: "/chef",
  teacher: "/teacher",
  student: "/student",
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "University Admin",
  institution_admin: "Institution Admin",
  chef: "Chef",
  teacher: "Teacher",
  student: "Student",
};

export const PREP_LABEL = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  delayed: "Delayed",
} as const;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const SERVICE_CATEGORIES = {
  electrical: "Electrical repairs",
  gas: "Gas supply",
  exhaust: "Exhaust / ventilation",
  equipment: "Equipment repair",
  ingredients: "Ingredient requirement",
  support: "Additional kitchen support",
  other: "Other",
} as const;

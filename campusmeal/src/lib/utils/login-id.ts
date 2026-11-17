/** Domain used for the auth emails behind student-ID logins (never shown to users). */
export const STUDENT_LOGIN_DOMAIN = "students.dineos";

/** KMOIA + 7 → "KMOIA007". */
export function studentLoginId(institutionCode: string, admissionNo: number): string {
  return `${institutionCode.toUpperCase()}${String(admissionNo).padStart(3, "0")}`;
}

/** The auth email behind a student login ID. */
export function studentLoginEmail(loginId: string): string {
  return `${loginId.toLowerCase()}@${STUDENT_LOGIN_DOMAIN}`;
}

/**
 * Turn what someone typed in the sign-in box into the auth email.
 * Anything with "@" is used as an email; anything else is a student ID.
 */
export function identifierToEmail(identifier: string): string {
  const v = identifier.trim();
  return v.includes("@") ? v.toLowerCase() : studentLoginEmail(v);
}

/** Shown in tables: "Abu - 001". */
export function numberedName(name: string, admissionNo: number | null | undefined): string {
  if (!admissionNo || /\s-\s\d+$/.test(name)) return name;
  return `${name} - ${String(admissionNo).padStart(3, "0")}`;
}

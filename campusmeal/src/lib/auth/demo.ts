// Demo sign-in that does not depend on Supabase Auth.
// The demo accounts (password 123) sign in with a signed cookie instead of a
// Supabase session. Their ids match supabase/seed.sql, so seeded data still shows.
// Works in both the Node runtime and the proxy (Web Crypto only).
import type { Institution, Role } from "@/types/domain";

export const DEMO_COOKIE = "dineos_demo";
export const DEMO_PASSWORD = "123";
export const DEMO_INSTITUTION_ID = "11111111-1111-1111-1111-111111111111";
const STUDENT_COUNT = 240;

export interface DemoUser {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  institutionId: string | null;
}

const STAFF: Record<string, DemoUser> = {
  "test@superadmin": { userId: "a0000000-0000-0000-0000-000000000001", email: "test@superadmin", fullName: "Super Admin", role: "super_admin", institutionId: null },
  "test@instadmin": { userId: "a0000000-0000-0000-0000-000000000002", email: "test@instadmin", fullName: "Institution Admin", role: "institution_admin", institutionId: DEMO_INSTITUTION_ID },
  "test@chef": { userId: "a0000000-0000-0000-0000-000000000003", email: "test@chef", fullName: "Chef", role: "chef", institutionId: DEMO_INSTITUTION_ID },
  "test@teacher": { userId: "a0000000-0000-0000-0000-000000000011", email: "test@teacher", fullName: "Teacher", role: "teacher", institutionId: DEMO_INSTITUTION_ID },
};

const NAMES = ["Abu", "Malik", "Nizam", "Yusuf", "Ibrahim", "Ismail", "Ishaq", "Yaqub", "Musa", "Haroon"];

export const DEMO_INSTITUTION: Institution = {
  id: DEMO_INSTITUTION_ID,
  name: "KMO Islamic Academy",
  code: "KMOIA",
  timezone: "Asia/Kolkata",
  default_table_capacity: 10,
  default_cancel_days_before: 1,
  default_cancel_time: "20:00",
  supplier_rotation_days: 30,
  active: true,
  is_demo: true,
};

/** Look up a demo account by what was typed in the sign-in box. */
export function findDemoUser(identifier: string): DemoUser | null {
  const v = identifier.trim().toLowerCase().replace(/\.demo$/, "");
  if (STAFF[v]) return STAFF[v];
  const m = /^kmoia(\d{1,3})$/.exec(v);
  const n = m ? Number(m[1]) : 0;
  if (n < 1 || n > STUDENT_COUNT) return null;
  const num = String(n).padStart(3, "0");
  return {
    userId: `a1000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    email: `kmoia${num}@students.dineos`,
    fullName: `${NAMES[(n - 1) % NAMES.length]} - ${num}`,
    role: "student",
    institutionId: DEMO_INSTITUTION_ID,
  };
}

function secret() {
  return process.env.DEMO_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dineos-demo-session";
}

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

/**
 * A Supabase access token for a demo user, signed with the project's JWT secret,
 * so RLS and auth.uid() treat the demo user like a normal sign-in. Null if no secret is set.
 */
export async function demoAccessToken(user: DemoUser): Promise<string | null> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) return null;
  const enc = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const now = Math.floor(Date.now() / 1000);
  const body = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: user.userId, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 })}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(jwtSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `${body}.${b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))))}`;
}

/** Cookie value for a demo user: "<identifier>.<signature>". */
export async function demoToken(identifier: string) {
  const id = identifier.trim().toLowerCase().replace(/\.demo$/, "");
  return `${id}.${await sign(id)}`;
}

/** Verify a demo cookie value and return its user. */
export async function readDemoToken(token: string | undefined | null): Promise<DemoUser | null> {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const id = token.slice(0, i);
  if (token.slice(i + 1) !== (await sign(id))) return null;
  return findDemoUser(id);
}

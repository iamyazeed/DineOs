import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseEnv } from "@/config/env";
import { DEMO_COOKIE, readDemoToken } from "@/lib/auth/demo";

const PUBLIC_PATHS = ["/", "/login", "/unauthorized", "/setup"];

/** Refreshes the auth session cookie and redirects anonymous users to /login. */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Demo sessions don't use Supabase Auth.
  if (await readDemoToken(request.cookies.get(DEMO_COOKIE)?.value)) return NextResponse.next();
  if (!isSupabaseConfigured()) {
    if (PUBLIC_PATHS.includes(path)) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && !PUBLIC_PATHS.includes(path)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return response;
}

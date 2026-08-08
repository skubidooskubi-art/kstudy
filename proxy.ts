import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";

// Routes requiring authentication
const PROTECTED = ["/setup", "/dashboard"];

// Routes logged-in users should skip (redirect to /setup)
const AUTH_ONLY = ["/sign-in", "/sign-up"];

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through API and static asset requests
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED.some((r) => pathname.startsWith(r));
  const isAuthOnly  = AUTH_ONLY.some((r) => pathname.startsWith(r));

  if (!isProtected && !isAuthOnly) return NextResponse.next();

  // Check session in-process (no self-fetch to avoid Docker hairpin NAT)
  let isLoggedIn = false;
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    isLoggedIn = !!session?.user;
  } catch (err: any) {
    console.error("[PROXY] Session check error:", err.message);
  }

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/sign-in", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthOnly && isLoggedIn) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  return NextResponse.next();
}

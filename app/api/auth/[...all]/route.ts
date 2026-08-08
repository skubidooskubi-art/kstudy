import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";

// Resolve auth once per cold start, then reuse
let cachedHandler: ReturnType<typeof toNextJsHandler> | null = null;

async function handler(req: NextRequest) {
  console.log(`[AUTH API] ${req.method} ${req.nextUrl.pathname}`);
  console.log(`[AUTH API] Query params:`, Object.fromEntries(req.nextUrl.searchParams));
  console.log(`[AUTH API] Headers:`, {
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    "x-forwarded-proto": req.headers.get("x-forwarded-proto"),
    "x-forwarded-host": req.headers.get("x-forwarded-host"),
    "x-real-ip": req.headers.get("x-real-ip"),
  });

  if (!cachedHandler) {
    console.log("[AUTH API] Initializing auth handler...");
    const auth    = await getAuth();
    cachedHandler = toNextJsHandler(auth);
    console.log("[AUTH API] Auth handler initialized");
  }

  // Route to GET or POST based on method
  const method = req.method.toUpperCase();
  console.log(`[AUTH API] Routing to ${method}`);

  try {
    const response = method === "POST"
      ? await cachedHandler.POST(req)
      : await cachedHandler.GET(req);

    console.log(`[AUTH API] Response status: ${response.status}`);
    console.log(`[AUTH API] Set-Cookie:`, response.headers.get("set-cookie"));
    console.log(`[AUTH API] Location:`, response.headers.get("location"));

    return response;
  } catch (err: any) {
    console.error("[AUTH API] Error:", err.message, err.stack);
    throw err;
  }
}

export const GET  = handler;
export const POST = handler;

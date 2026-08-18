import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip PWA worker + manifest: a 307 to /login makes Chrome refuse SW
  // registration ("script resource is behind a redirect").
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|swe-worker-[^/]+\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

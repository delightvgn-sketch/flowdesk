import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk session handling for every request. Authorization is deliberately not
 * done here by path matching: each page, server action and route handler
 * resolves the user itself (src/server/auth/session.ts), and Postgres RLS
 * enforces data access underneath that.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

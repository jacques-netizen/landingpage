import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /api/admin is gated by its own ADMIN_SECRET check, not a Clerk session —
// it needs to be callable directly (support tooling, scripts), same as webhooks.
const isPublic = createRouteMatcher(["/", "/join", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)", "/api/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};

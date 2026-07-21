import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import { discordAuthorizeUrl } from "@/lib/discord";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(discordAuthorizeUrl(state));
  res.cookies.set("discord_oauth_state", state, { httpOnly: true, maxAge: 300, path: "/", sameSite: "lax" });
  return res;
}

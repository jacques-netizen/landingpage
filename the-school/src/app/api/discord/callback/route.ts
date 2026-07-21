import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { exchangeDiscordCode, fetchDiscordIdentity } from "@/lib/discord";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("discord_oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/onboarding?discord=error", req.url));
  }

  const member = await db.member.findUnique({ where: { clerkUserId: userId } });
  if (!member) return NextResponse.redirect(new URL("/onboarding", req.url));

  try {
    const token = await exchangeDiscordCode(code);
    const identity = await fetchDiscordIdentity(token.access_token);

    const existing = await db.member.findUnique({ where: { discordUserId: identity.id } });
    if (existing && existing.id !== member.id) {
      return NextResponse.redirect(new URL("/onboarding?discord=taken", req.url));
    }

    await db.member.update({ where: { id: member.id }, data: { discordUserId: identity.id } });
    await emitEvent(member.id, "discord_linked", { discordUserId: identity.id });
  } catch {
    return NextResponse.redirect(new URL("/onboarding?discord=error", req.url));
  }

  const res = NextResponse.redirect(new URL("/onboarding", req.url));
  res.cookies.delete("discord_oauth_state");
  return res;
}

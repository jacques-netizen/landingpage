/**
 * Account-linking OAuth helpers (identify scope only — the bot handles role
 * grants separately via discord.js). Redirect URI is derived from APP_URL so
 * there's one place to change when the app moves.
 */
const REDIRECT_URI = () => `${process.env.APP_URL}/api/discord/callback`;

export function discordAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: REDIRECT_URI(),
    response_type: "code",
    scope: "identify",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(code: string): Promise<{ access_token: string }> {
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI(),
    }),
  });
  if (!res.ok) throw new Error("Discord token exchange failed");
  return res.json();
}

export async function fetchDiscordIdentity(accessToken: string): Promise<{ id: string; username: string }> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Discord identity fetch failed");
  return res.json();
}

/**
 * Discord bot: the other end of the spine, plus Phase 3 extras.
 * Polls unsynced Events and acts on them:
 *  - access_changed      -> grants/revokes the Member + school-wing roles
 *  - discord_linked      -> sends the onboarding DM
 *  - campus_completed    -> posts an announcement
 *  - assignment_shipped  -> recomputes rank roles from Member.rank
 *
 * Role/channel IDs live in env — the server layout is the founder's to change.
 * Runs as a separate process (Railway/Fly/VPS): `npm run bot`
 */
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const ROLE_MEMBER = process.env.DISCORD_ROLE_MEMBER!;       // paid member role
const ROLE_FOUNDERS = process.env.DISCORD_ROLE_FOUNDERS!;   // founders wing
const ROLE_ARTISTS = process.env.DISCORD_ROLE_ARTISTS!;     // artists wing
const CHANNEL_ANNOUNCEMENTS = process.env.DISCORD_CHANNEL_ANNOUNCEMENTS; // optional

// Optional: rank -> role id, e.g. {"1":"...","5":"...","10":"..."}.
// The bot grants the highest threshold the member's rank clears and removes the rest.
const RANK_ROLES: [number, string][] = process.env.DISCORD_RANK_ROLES
  ? Object.entries(JSON.parse(process.env.DISCORD_RANK_ROLES) as Record<string, string>)
      .map(([rank, roleId]) => [Number(rank), roleId] as [number, string])
      .sort((a, b) => a[0] - b[0])
  : [];

async function syncAccessEvents() {
  const events = await db.event.findMany({
    where: { type: "access_changed", syncedToSetterQueue: false },
    include: { member: { include: { school: true } } },
    take: 25,
  });

  const guild = await client.guilds.fetch(GUILD_ID);

  for (const ev of events) {
    const m = ev.member;
    if (!m?.discordUserId) {
      // Can't sync without a linked Discord — leave unsynced; the app links
      // Discord at onboarding and the next poll picks it up.
      continue;
    }
    try {
      const guildMember = await guild.members.fetch(m.discordUserId);
      const active = m.accessStatus === "active" || m.accessStatus === "past_due";

      if (active) {
        await guildMember.roles.add(ROLE_MEMBER);
        // School wing role, driven by data — new schools just need a new env role id
        if (m.school?.slug === "founders") await guildMember.roles.add(ROLE_FOUNDERS);
        if (m.school?.slug === "artists") await guildMember.roles.add(ROLE_ARTISTS);
      } else {
        await guildMember.roles.remove(ROLE_MEMBER).catch(() => {});
        await guildMember.roles.remove(ROLE_FOUNDERS).catch(() => {});
        await guildMember.roles.remove(ROLE_ARTISTS).catch(() => {});
      }
      await db.event.update({ where: { id: ev.id }, data: { syncedToSetterQueue: true } });
      console.log(`role sync: ${m.email} -> ${m.accessStatus}`);
    } catch (e) {
      console.error(`role sync failed for ${m.email}:`, e);
    }
  }
}

async function syncOnboardingDMs() {
  const events = await db.event.findMany({
    where: { type: "discord_linked", syncedToSetterQueue: false },
    include: { member: true },
    take: 25,
  });

  const guild = await client.guilds.fetch(GUILD_ID);

  for (const ev of events) {
    const m = ev.member;
    if (!m?.discordUserId) continue;
    try {
      const guildMember = await guild.members.fetch(m.discordUserId);
      await guildMember.send(
        "You're linked up. Your member role lands as soon as your membership is active — head back to the dashboard if you haven't finished checkout yet."
      );
      await db.event.update({ where: { id: ev.id }, data: { syncedToSetterQueue: true } });
      console.log(`onboarding DM sent: ${m.email}`);
    } catch (e) {
      console.error(`onboarding DM failed for ${m.email}:`, e);
      await db.event.update({ where: { id: ev.id }, data: { syncedToSetterQueue: true } });
    }
  }
}

async function syncAnnouncements() {
  if (!CHANNEL_ANNOUNCEMENTS) return;
  const events = await db.event.findMany({
    where: { type: "campus_completed", syncedToSetterQueue: false },
    include: { member: true },
    take: 25,
  });
  if (events.length === 0) return;

  const channel = await client.channels.fetch(CHANNEL_ANNOUNCEMENTS);
  if (!channel || !(channel instanceof TextChannel)) return;

  for (const ev of events) {
    const m = ev.member;
    const campusId = (ev.payload as { campusId?: string })?.campusId;
    const campus = campusId ? await db.campus.findUnique({ where: { id: campusId } }) : null;
    try {
      await channel.send(
        `🎉 ${m?.name ?? m?.email ?? "A member"} just finished **${campus?.name ?? "a campus"}**.`
      );
      await db.event.update({ where: { id: ev.id }, data: { syncedToSetterQueue: true } });
    } catch (e) {
      console.error(`announcement failed for event ${ev.id}:`, e);
    }
  }
}

async function syncRankRoles() {
  if (RANK_ROLES.length === 0) return;
  const events = await db.event.findMany({
    where: { type: "assignment_shipped", syncedToSetterQueue: false },
    include: { member: true },
    take: 25,
  });
  if (events.length === 0) return;

  const guild = await client.guilds.fetch(GUILD_ID);

  for (const ev of events) {
    const m = ev.member;
    if (!m?.discordUserId) continue;
    try {
      const guildMember = await guild.members.fetch(m.discordUserId);
      const earned = RANK_ROLES.filter(([threshold]) => m.rank >= threshold);
      const targetRoleId = earned.length > 0 ? earned[earned.length - 1][1] : null;

      for (const [, roleId] of RANK_ROLES) {
        if (roleId === targetRoleId) await guildMember.roles.add(roleId);
        else await guildMember.roles.remove(roleId).catch(() => {});
      }
      await db.event.update({ where: { id: ev.id }, data: { syncedToSetterQueue: true } });
      console.log(`rank sync: ${m.email} -> rank ${m.rank}`);
    } catch (e) {
      console.error(`rank sync failed for ${m.email}:`, e);
    }
  }
}

async function pollAll() {
  await syncAccessEvents();
  await syncOnboardingDMs();
  await syncAnnouncements();
  await syncRankRoles();
}

client.once("ready", () => {
  console.log(`Bot ready as ${client.user?.tag}`);
  setInterval(() => void pollAll(), 15_000); // poll every 15s — simple and reliable
});

client.login(process.env.DISCORD_BOT_TOKEN);

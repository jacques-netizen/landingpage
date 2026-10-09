import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Sanitized query params: src, mc, utm_*. Never the first name.
  source: jsonb("source").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  variant: text("variant").notNull(),
  progressMode: text("progress_mode").notNull(),
  deviceClass: text("device_class").notNull(),
  lastScene: text("last_scene"),
});

export const answers = pgTable(
  "answers",
  {
    sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    value: jsonb("value").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("answers_session_question").on(t.sessionId, t.questionId)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    email: text("email").notNull(),
    igHandle: text("ig_handle"),
    company: text("company"),
    consentTextVersion: text("consent_text_version").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    qualified: boolean("qualified").notNull(),
    humanPriority: boolean("human_priority").notNull(),
    path: text("path").notNull(),
    // A/B arm at gate time. The plain arm asks no budget, so its buyers are offered the call.
    variant: text("variant").notNull().default("full"),
    // Snapshot of the answers at gate time, so the guide and CRM never drift.
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
    ghlContactId: text("ghl_contact_id"),
    ghlOpportunityId: text("ghl_opportunity_id"),
    metaEventId: text("meta_event_id").notNull(),
    fbp: text("fbp"),
    fbc: text("fbc"),
    clientIp: text("client_ip"),
    userAgent: text("user_agent"),
    bookedAt: timestamp("booked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("leads_session").on(t.sessionId), index("leads_email").on(t.email)],
);

export const guides = pgTable("guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").notNull().unique().references(() => leads.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  storageKey: text("storage_key"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  emailedAt: timestamp("emailed_at", { withTimezone: true }),
  contentManifestVersion: text("content_manifest_version"),
  error: text("error"),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    props: jsonb("props").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_name_at").on(t.name, t.at), index("events_session").on(t.sessionId)],
);

// Background work after the gate. One row per lead and kind, so retries are
// idempotent: a job that is done is never run again.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("jobs_lead_kind").on(t.leadId, t.kind), index("jobs_status_run_after").on(t.status, t.runAfter)],
);

export const unsubscribes = pgTable("unsubscribes", {
  email: text("email").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { findContactByEmail, ghlEnabled, markUnsubscribed } from "./ghl";

/** Adds the address to the app's own list and honors it in GHL. */
export async function unsubscribe(email: string) {
  const db = await getDb();
  await db.insert(schema.unsubscribes).values({ email }).onConflictDoNothing();
  if (!ghlEnabled()) return;
  try {
    const [lead] = await db.select({ id: schema.leads.ghlContactId }).from(schema.leads).where(eq(schema.leads.email, email)).limit(1);
    const contactId = lead?.id || (await findContactByEmail(email));
    if (contactId) await markUnsubscribed(contactId);
  } catch (e) {
    // The app list already holds it; GHL is retried by the next unsubscribe or by hand.
    console.error("GHL unsubscribe failed", e);
  }
}

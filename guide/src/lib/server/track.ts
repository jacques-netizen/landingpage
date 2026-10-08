import "server-only";
import { getDb, schema } from "@/db";
import { cleanProps, type EventName } from "@/lib/events";

/** Server side event, same table and rules as /api/event. */
export async function track(sessionId: string | null, name: EventName, props: Record<string, unknown> = {}) {
  try {
    const db = await getDb();
    await db.insert(schema.events).values({ sessionId, name, props: cleanProps(props) });
  } catch (e) {
    console.error("event insert failed", e);
  }
}

/**
 * Every meaningful member action emits an Event (CLAUDE.md Rule 5).
 * The Discord bot polls and acts on these. Silence is a bug: when adding
 * features, ask what event they should emit.
 */
import { db } from "./db";

export async function emitEvent(
  memberId: string | null,
  type: string,
  payload: Record<string, unknown> = {}
) {
  return db.event.create({ data: { memberId, type, payload: payload as object } });
}

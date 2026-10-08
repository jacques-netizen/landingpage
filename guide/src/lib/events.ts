// Event names from section 11.1. Shared by the client and the event route.
export const EVENT_NAMES = [
  "scene_view",
  "video_play",
  "video_progress",
  "video_pause",
  "question_answered",
  "back_pressed",
  "gate_view",
  "gate_error",
  "gate_submit",
  "build_complete",
  "result_view",
  "guide_download",
  "booking_view",
  "booking_created",
  "join_click",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const FORBIDDEN = /email|name|phone|handle|company|ip/i;

/** Keeps small, flat, non personal props only. */
export function cleanProps(props: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props || typeof props !== "object") return out;
  for (const [k, v] of Object.entries(props as Record<string, unknown>).slice(0, 12)) {
    if (FORBIDDEN.test(k) || k.length > 40) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && !v.includes("@")) out[k] = v.slice(0, 80);
  }
  return out;
}

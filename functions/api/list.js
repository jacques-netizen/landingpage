// Authenticated status endpoint for the admin page: which slots have a video,
// how big, and when it was uploaded.
import { isAuthed, json } from '../../lib/auth.js';
import { SLOTS } from '../../lib/slots.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.MEDIA) return json({ error: 'R2 bucket binding "MEDIA" is not configured' }, 500);
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);

  const out = [];
  for (const s of SLOTS) {
    const head = await env.MEDIA.head(s.key);
    out.push({
      key: s.key,
      label: s.label,
      exists: !!head,
      size: head ? head.size : 0,
      uploaded: head && head.uploaded ? head.uploaded : null,
      contentType: head && head.httpMetadata ? head.httpMetadata.contentType : null,
    });
  }
  return json({ slots: out });
}

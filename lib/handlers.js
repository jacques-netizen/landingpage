// Shared request handlers used by BOTH the Worker entry (worker.js) and the
// Pages Functions (functions/*). One source of truth for the logic.
import { isAuthed, json } from './auth.js';
import { SLOT_KEYS, SLOTS } from './slots.js';

// ---- POST /api/notify : ping a Discord channel when someone books ----
export async function handleNotify(request, env) {
  if (request.method.toUpperCase() !== 'POST') return json({ error: 'method not allowed' }, 405);
  const hook = env.DISCORD_WEBHOOK_URL;
  if (!hook) return json({ error: 'DISCORD_WEBHOOK_URL not configured' }, 500);

  let lead = null;
  let note = '';
  try {
    const b = await request.json();
    if (b && b.lead && typeof b.lead === 'object') lead = b.lead;
    if (b && b.note) note = String(b.note).slice(0, 300);
  } catch (e) { /* no body is fine */ }

  const clean = (v) => String(v == null ? '' : v).replace(/[`@]/g, '').slice(0, 300).trim();

  let content;
  if (lead) {
    const rows = [
      ['👤 Name', lead.name],
      ['📞 Phone', lead.phone],
      ['✉️ Email', lead.email],
      ['🏷️ Business', lead.business],
      ['🔗 IG / Website', lead.link],
      ['🎯 6-month goal', lead.goal],
      ['💸 Invested before', lead.invested],
      ['💰 Budget', lead.budget],
      ['⏱️ Timeline', lead.timing],
      ['📝 Notes', lead.notes],
    ];
    const lines = rows
      .filter(([, v]) => clean(v))
      .map(([label, v]) => `**${label}:** ${clean(v)}`);
    content = '📅 **New discovery call booked — call them now!**\n' + lines.join('\n')
      + '\n\nExact time is in Calendly.';
  } else {
    content = '📅 **New discovery call booked!** Someone just scheduled through the site.'
      + (note ? ('\n' + note) : '')
      + '\nCheck Calendly for the details.';
  }

  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return json({ ok: res.ok });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 502);
  }
}

// ---- POST/DELETE /api/upload : authenticated R2 multipart upload ----
export async function handleUpload(request, env) {
  if (!env.MEDIA) return json({ error: 'R2 bucket binding "MEDIA" is not configured' }, 500);
  if (!isAuthed(request, env)) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const slot = url.searchParams.get('slot') || '';
  if (!SLOT_KEYS.includes(slot)) return json({ error: 'unknown slot' }, 400);

  const method = request.method.toUpperCase();

  if (method === 'DELETE') {
    await env.MEDIA.delete(slot);
    return json({ ok: true, deleted: slot });
  }
  if (method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const action = url.searchParams.get('action') || '';
  try {
    if (action === 'create') {
      const contentType = request.headers.get('x-file-type') || 'video/mp4';
      const mpu = await env.MEDIA.createMultipartUpload(slot, { httpMetadata: { contentType } });
      return json({ uploadId: mpu.uploadId });
    }
    if (action === 'part') {
      const uploadId = url.searchParams.get('uploadId');
      const partNumber = parseInt(url.searchParams.get('part'), 10);
      if (!uploadId || !partNumber) return json({ error: 'missing uploadId or part' }, 400);
      const mpu = env.MEDIA.resumeMultipartUpload(slot, uploadId);
      const buf = await request.arrayBuffer();
      const part = await mpu.uploadPart(partNumber, buf);
      return json({ partNumber: part.partNumber, etag: part.etag });
    }
    if (action === 'complete') {
      const uploadId = url.searchParams.get('uploadId');
      if (!uploadId) return json({ error: 'missing uploadId' }, 400);
      const body = await request.json();
      const parts = (body.parts || []).map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
      const mpu = env.MEDIA.resumeMultipartUpload(slot, uploadId);
      const obj = await mpu.complete(parts);
      return json({ ok: true, slot, size: obj.size });
    }
    if (action === 'abort') {
      const uploadId = url.searchParams.get('uploadId');
      if (uploadId) {
        const mpu = env.MEDIA.resumeMultipartUpload(slot, uploadId);
        await mpu.abort();
      }
      return json({ ok: true });
    }
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) }, 500);
  }
  return json({ error: 'unknown action' }, 400);
}

// ---- GET /api/list : authenticated slot status for the admin page ----
export async function handleList(request, env) {
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

// ---- GET/HEAD /v/<slot> : public media server with Range support ----
function metaHeaders(meta, size) {
  const h = new Headers();
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'public, max-age=300');
  if (meta && meta.contentType) h.set('content-type', meta.contentType);
  if (typeof size === 'number') h.set('content-length', String(size));
  return h;
}

export async function handleMedia(request, env) {
  if (!env.MEDIA) return new Response('storage not configured', { status: 500 });

  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/v\//, ''));
  if (!key) return new Response('not found', { status: 404 });

  const method = request.method.toUpperCase();

  if (method === 'HEAD') {
    const head = await env.MEDIA.head(key);
    if (!head) return new Response(null, { status: 404 });
    return new Response(null, { status: 200, headers: metaHeaders(head.httpMetadata, head.size) });
  }
  if (method !== 'GET') return new Response('method not allowed', { status: 405 });

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (m) {
      const head = await env.MEDIA.head(key);
      if (!head) return new Response('not found', { status: 404 });
      const size = head.size;
      let start = m[1] === '' ? undefined : parseInt(m[1], 10);
      let end = m[2] === '' ? undefined : parseInt(m[2], 10);
      let offset, length;
      if (start === undefined) {
        length = end; offset = Math.max(0, size - end); start = offset; end = size - 1;
      } else {
        offset = start;
        if (end === undefined || end >= size) end = size - 1;
        length = end - start + 1;
      }
      const obj = await env.MEDIA.get(key, { range: { offset, length } });
      if (!obj) return new Response('not found', { status: 404 });
      const h = metaHeaders(obj.httpMetadata, length);
      h.set('content-range', `bytes ${start}-${end}/${size}`);
      return new Response(obj.body, { status: 206, headers: h });
    }
  }

  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, { status: 200, headers: metaHeaders(obj.httpMetadata, obj.size) });
}

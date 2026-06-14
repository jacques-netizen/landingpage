// Authenticated upload endpoint backed by R2 multipart uploads, so a video of
// any size can be sent from the phone in chunks (no single-request size limit).
//
//   POST /api/upload?slot=KEY&action=create            -> { uploadId }
//   POST /api/upload?slot=KEY&action=part&uploadId&part -> { partNumber, etag }
//   POST /api/upload?slot=KEY&action=complete&uploadId  -> { ok, size }   (body: {parts})
//   POST /api/upload?slot=KEY&action=abort&uploadId     -> { ok }
//   DELETE /api/upload?slot=KEY                          -> { ok }
import { isAuthed, json } from '../../lib/auth.js';
import { SLOT_KEYS } from '../../lib/slots.js';

export async function onRequest(context) {
  const { request, env } = context;

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

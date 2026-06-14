// Public media server: streams a video from R2 at /v/<slot>.
// Supports HEAD (used by the site to detect whether a video exists yet) and
// HTTP Range requests (so videos can be scrubbed/seeked in the player).
function keyFromParams(params) {
  const p = params && params.path;
  return Array.isArray(p) ? p.join('/') : String(p || '');
}

function metaHeaders(meta, size) {
  const h = new Headers();
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'public, max-age=300');
  if (meta && meta.contentType) h.set('content-type', meta.contentType);
  if (typeof size === 'number') h.set('content-length', String(size));
  return h;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.MEDIA) return new Response('storage not configured', { status: 500 });

  const key = keyFromParams(params);
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
        // suffix range: last N bytes
        length = end;
        offset = Math.max(0, size - end);
        start = offset;
        end = size - 1;
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

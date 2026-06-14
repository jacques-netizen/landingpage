// Minimal auth for the single-admin upload tool. The admin page sends the
// password as `Authorization: Bearer <password>` over HTTPS, and we compare it
// to the ADMIN_PASSWORD secret configured in the Cloudflare Pages project.

export function getProvidedSecret(request) {
  const h = request.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return '';
}

// Constant-time-ish comparison to avoid trivial timing attacks.
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function isAuthed(request, env) {
  const pw = (env && env.ADMIN_PASSWORD) || '';
  if (!pw) return false;
  return constantTimeEqual(getProvidedSecret(request), pw);
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

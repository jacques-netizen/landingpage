// Worker entry. Handles the upload API and media streaming; everything else
// (index.html, /admin, /talent, images) is served from static assets.
import { handleUpload, handleList, handleMedia, handleNotify } from './lib/handlers.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/upload') return handleUpload(request, env);
    if (path === '/api/list') return handleList(request, env);
    if (path === '/api/notify') return handleNotify(request, env);
    if (path.startsWith('/v/')) return handleMedia(request, env);

    // Static site (served by the assets binding).
    return env.ASSETS.fetch(request);
  },
};

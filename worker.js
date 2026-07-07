// Worker entry. Handles the upload API and media streaming; everything else
// (index.html, /admin, /talent, images) is served from static assets.
import { handleUpload, handleList, handleMedia, handleNotify, handleCampaign, handleCampaignList, handleCampaignImport, pullCampaignCSV, handleWhopProbe, handleThumbTest, handleResolveThumbs, handleImageProxy, resolveStoredThumbnails } from './lib/handlers.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/upload') return handleUpload(request, env);
    if (path === '/api/list') return handleList(request, env);
    if (path === '/api/notify') return handleNotify(request, env);
    if (path === '/api/campaign') return handleCampaign(request, env);
    if (path === '/api/campaigns') return handleCampaignList(request, env);
    if (path === '/api/campaign/import') return handleCampaignImport(request, env, ctx);
    if (path === '/api/campaign/whop') return handleWhopProbe(request, env);
    if (path === '/api/campaign/thumbtest') return handleThumbTest(request, env);
    if (path === '/api/campaign/resolve') return handleResolveThumbs(request, env);
    if (path === '/api/img') return handleImageProxy(request, env);
    if (path.startsWith('/v/')) return handleMedia(request, env);

    // On the booking subdomain (book.*), the root IS the calendar.
    if (url.hostname.startsWith('book.') && path === '/') {
      return Response.redirect(new URL('/book', request.url).toString(), 302);
    }

    // Per-client campaign dashboards on campaigns.maisondelites.com:
    //   /<slug>        -> that client's dashboard
    //   /<slug>/admin  -> that client's editor
    //   /              -> a branded placeholder (no public client list)
    // The dashboard/admin pages read the slug from the URL and call the API with
    // ?client=<slug>. Reserved words and real files fall through to the assets.
    if (url.hostname.startsWith('campaigns.')) {
      const RESERVED = new Set(['api', 'v', 'img', 'dashboard', 'campaign-admin', 'campaign-hub', 'book', 'booked', 'admin', 'assets', 'favicon.ico', 'robots.txt']);
      const seg = path.split('/').filter(Boolean);
      const serve = (p) => env.ASSETS.fetch(new Request(new URL(p, url).toString(), request));
      if (seg.length === 0) return serve('/campaigns/index.html');
      // /admin -> operator hub listing every client
      if (seg.length === 1 && seg[0] === 'admin') return serve('/campaign-hub/index.html');
      const looksLikeFile = seg[seg.length - 1].includes('.');
      if (!looksLikeFile && !RESERVED.has(seg[0])) {
        if (seg.length === 1) return serve('/dashboard/index.html');
        if (seg.length === 2 && seg[1] === 'admin') return serve('/campaign-admin/index.html');
      }
    }

    // Static site (served by the assets binding).
    return env.ASSETS.fetch(request);
  },

  // Cron trigger (see wrangler.toml). Pulls the campaign CSV source, if one is
  // configured via the CAMPAIGN_CSV_URL var, and refreshes the dashboard data.
  async scheduled(event, env, ctx) {
    // Refresh from a CSV source if configured, and fill in any thumbnails that
    // didn't resolve at publish time — so every tile self-heals within the cron
    // interval.
    ctx.waitUntil((async () => {
      await pullCampaignCSV(env);
      await resolveStoredThumbnails(env);
    })());
  },
};

import { handleCampaignImport } from '../../../lib/handlers.js';
export const onRequest = (ctx) => handleCampaignImport(ctx.request, ctx.env, ctx);

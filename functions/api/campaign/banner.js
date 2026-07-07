import { handleCampaignBanner } from '../../../lib/handlers.js';
export const onRequest = (ctx) => handleCampaignBanner(ctx.request, ctx.env);

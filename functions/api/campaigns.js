import { handleCampaignList } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleCampaignList(ctx.request, ctx.env);

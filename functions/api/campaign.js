import { handleCampaign } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleCampaign(ctx.request, ctx.env);

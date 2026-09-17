import { handleBrandSheet } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleBrandSheet(ctx.request, ctx.env, ctx);

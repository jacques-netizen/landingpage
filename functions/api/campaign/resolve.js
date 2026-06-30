import { handleResolveThumbs } from '../../../lib/handlers.js';
export const onRequest = (ctx) => handleResolveThumbs(ctx.request, ctx.env);

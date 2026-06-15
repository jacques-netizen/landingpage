import { handleNotify } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleNotify(ctx.request, ctx.env);

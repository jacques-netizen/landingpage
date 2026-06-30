import { handleWhopProbe } from '../../../lib/handlers.js';
export const onRequest = (ctx) => handleWhopProbe(ctx.request, ctx.env);

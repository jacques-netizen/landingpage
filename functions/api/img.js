import { handleImageProxy } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleImageProxy(ctx.request, ctx.env);

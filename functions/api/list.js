import { handleList } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleList(ctx.request, ctx.env);

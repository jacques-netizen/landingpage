import { handleMedia } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleMedia(ctx.request, ctx.env);

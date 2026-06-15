import { handleUpload } from '../../lib/handlers.js';
export const onRequest = (ctx) => handleUpload(ctx.request, ctx.env);

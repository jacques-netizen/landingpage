import { handleThumbTest } from '../../../lib/handlers.js';
export const onRequest = (ctx) => handleThumbTest(ctx.request, ctx.env);

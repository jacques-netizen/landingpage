import path from "node:path";
import os from "node:os";

/**
 * Where the no-config fallbacks keep their files (embedded database, PDFs,
 * email previews). The project folder locally; the writable temp folder on
 * serverless hosts, where the project folder is read only. Fine for a
 * preview deploy; production sets DATABASE_URL and STORAGE_* instead.
 */
export function dataDir(...parts: string[]) {
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  return path.join(serverless ? path.join(os.tmpdir(), "guide-data") : path.join(process.cwd(), ".data"), ...parts);
}

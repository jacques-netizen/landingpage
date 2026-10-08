// Database access. Production uses Postgres (Neon or Supabase) through
// DATABASE_URL. Without it, an embedded Postgres (PGlite) on local disk keeps
// the app runnable with no accounts. Migrations run once per process.
import path from "node:path";
import fs from "node:fs";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

const g = globalThis as unknown as { __guideDb?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL?.trim() || "";
  if (url && !url.startsWith("pglite:")) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  let dataDir: string | undefined;
  if (url !== "pglite:memory") {
    dataDir = url.startsWith("pglite:") ? url.slice("pglite:".length) : path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__guideDb) {
    g.__guideDb = connect().catch((e) => {
      g.__guideDb = undefined;
      throw e;
    });
  }
  return g.__guideDb;
}

export { schema };

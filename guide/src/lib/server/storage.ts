import "server-only";
// Generated PDFs live in Cloudflare R2 (S3 API) and are served by short lived
// signed URLs. Without storage config they go to .data/guides on local disk.
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { dataDir } from "./datadir";

const localDir = () => dataDir("guides");
const enabled = () => {
  const s = config().storage;
  return Boolean(s.endpoint && s.bucket && s.accessKeyId && s.secretAccessKey);
};

async function client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const s = config().storage;
  return new S3Client({ region: s.region, endpoint: s.endpoint, credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey } });
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (!enabled()) {
    const file = path.join(localDir(), key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    return;
  }
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await (await client()).send(new PutObjectCommand({ Bucket: config().storage.bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function objectExists(key: string): Promise<boolean> {
  if (!enabled()) return fs.existsSync(path.join(localDir(), key));
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  try {
    await (await client()).send(new HeadObjectCommand({ Bucket: config().storage.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** A signed URL for R2, or null when stored locally (the route streams it). */
export async function signedUrl(key: string, filename: string, seconds = 600): Promise<string | null> {
  if (!enabled()) return null;
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(
    await client(),
    new GetObjectCommand({ Bucket: config().storage.bucket, Key: key, ResponseContentDisposition: `inline; filename="${filename}"`, ResponseContentType: "application/pdf" }),
    { expiresIn: seconds },
  );
}

export function readLocal(key: string): Buffer | null {
  const file = path.join(localDir(), key);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

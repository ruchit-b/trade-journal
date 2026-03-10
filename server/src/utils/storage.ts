import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, ''); // base URL for public bucket access

const useR2 = !!(accountId && accessKeyId && secretAccessKey && bucketName && r2PublicUrl);

let s3Client: S3Client | null = null;
if (useR2) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000';

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function safeFilename(original: string): string {
  const ext = path.extname(original) || '';
  const base = path.basename(original, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${randomUUID()}${ext ? ext.toLowerCase() : ''}`;
}

/**
 * Upload a file. Returns the public URL.
 * - If R2 env vars are set: uploads to R2 bucket, returns CLOUDFLARE_R2_PUBLIC_URL/key.
 * - Otherwise: saves to server/uploads/, returns path /uploads/key so the client loads from its own origin (works with dev proxy and same-host production).
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const key = `screenshots/${safeFilename(filename)}`;

  if (useR2 && s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return `${r2PublicUrl}/${key}`;
  }

  ensureUploadsDir();
  const localPath = path.join(UPLOADS_DIR, key);
  const dir = path.dirname(localPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return `/uploads/${key}`;
}

/**
 * Delete a file by its public URL.
 * - R2: parses key from URL (r2PublicUrl/key).
 * - Local: accepts /uploads/... or BASE_URL/uploads/..., parses to uploads/... path.
 */
export async function deleteFile(url: string): Promise<void> {
  if (!url || typeof url !== 'string') return;

  if (useR2 && r2PublicUrl && url.startsWith(r2PublicUrl + '/')) {
    const key = url.slice(r2PublicUrl.length + 1);
    if (key) {
      await s3Client!.send(
        new DeleteObjectCommand({ Bucket: bucketName!, Key: key })
      );
    }
    return;
  }

  const pathPrefix = '/uploads/';
  const fullUrlPrefix = `${BASE_URL}/uploads/`;
  let relativePath: string | null = null;
  if (url.startsWith(pathPrefix)) {
    relativePath = url.slice(pathPrefix.length);
  } else if (url.startsWith(fullUrlPrefix)) {
    relativePath = url.slice(fullUrlPrefix.length);
  }
  if (relativePath) {
    const localPath = path.join(UPLOADS_DIR, relativePath);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
}

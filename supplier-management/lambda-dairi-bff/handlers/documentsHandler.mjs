// Handles /api/documents/{recordId} — S3 document list, pre-signed URLs, delete.

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getLogger }    from '../lib/logger.mjs';
import { response }     from '../lib/response.mjs';

const s3Client   = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const DOCS_BUCKET = process.env.DOCS_BUCKET || 'friquelme-firstpage';
const DOCS_PREFIX = 'patient-docs';

/**
 * Handle /api/documents/{recordId}[/{subPath}] routes.
 * Returns null when the path does not match.
 *
 * @param {string} rawPath Normalized request path.
 * @param {string} method  HTTP method.
 */
export async function handleDocuments(rawPath, method) {
  const docsMatch = rawPath.match(/^\/api\/documents\/(\d+)(\/(.+))?$/);
  if (!docsMatch) return null;

  const log      = getLogger();
  const recordId = docsMatch[1];
  const subPath  = docsMatch[3] ?? null;
  const prefix   = `${DOCS_PREFIX}/${recordId}/`;

  // GET /api/documents/{recordId} → list documents
  if (method === 'GET' && !subPath) {
    const res   = await s3Client.send(new ListObjectsV2Command({ Bucket: DOCS_BUCKET, Prefix: prefix }));
    const files = (res.Contents ?? [])
      .filter(obj => obj.Key !== prefix)
      .map(obj => {
        const rawName     = obj.Key.replace(prefix, '');
        const displayName = rawName.replace(/_/g, ' ').replace(/\.pdf$/, '') + '.pdf';
        return { key: obj.Key, name: displayName, size: obj.Size, lastModified: obj.LastModified };
      });
    return response(200, files);
  }

  // GET /api/documents/{recordId}/{encodedKey}/url → pre-signed download URL
  if (method === 'GET' && subPath && subPath.endsWith('/url')) {
    const fileKey = decodeURIComponent(subPath.slice(0, -4));
    const fullKey = `${DOCS_PREFIX}/${recordId}/${fileKey}`;
    const url     = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: DOCS_BUCKET, Key: fullKey }), { expiresIn: 300 });
    return response(200, { url });
  }

  // GET /api/documents/{recordId}/{encodedKey}/upload-url → pre-signed PUT URL
  if (method === 'GET' && subPath && subPath.endsWith('/upload-url')) {
    const fileKey = decodeURIComponent(subPath.slice(0, -11));
    const fullKey = `${DOCS_PREFIX}/${recordId}/${fileKey}`;
    const url     = await getSignedUrl(s3Client, new PutObjectCommand({ Bucket: DOCS_BUCKET, Key: fullKey, ContentType: 'application/pdf' }), { expiresIn: 300 });
    return response(200, { url, key: fullKey });
  }

  // DELETE /api/documents/{recordId}/{encodedKey} → delete document
  if (method === 'DELETE' && subPath) {
    const fileKey = decodeURIComponent(subPath);
    const fullKey = `${DOCS_PREFIX}/${recordId}/${fileKey}`;
    await s3Client.send(new DeleteObjectCommand({ Bucket: DOCS_BUCKET, Key: fullKey }));
    log.info('Document deleted', { fullKey });
    return response(200, { deleted: fullKey });
  }

  return response(405, { message: 'Método no permitido en /api/documents' });
}

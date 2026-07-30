// Handles /api/documents/{recordId} — S3 document list, pre-signed URLs, delete.

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getLogger }         from '../lib/logger.mjs';
import { response }          from '../lib/response.mjs';
import * as profScopeService from '../services/profScopeService.mjs';

// dairi-medical-documents lives in us-east-1, same region as this VPC and its S3
// Gateway Endpoint — patient documents used to live under friquelme-firstpage/
// patient-docs/ (the frontend hosting bucket), which is in sa-east-1 and therefore
// unreachable from this VPC-attached Lambda (no NAT Gateway, and S3 Gateway
// Endpoints are region-locked). Documents were migrated to this dedicated,
// same-region, non-public bucket instead of adding a Lambda-to-Lambda hop.
const s3Client    = new S3Client({ region: process.env.DOCS_BUCKET_REGION || 'us-east-1' });
const DOCS_BUCKET = process.env.DOCS_BUCKET || 'dairi-medical-documents';
const DOCS_PREFIX = 'patient-docs';

/**
 * Handle /api/documents/{recordId}[/{subPath}] routes.
 * Returns null when the path does not match.
 *
 * `recordId` is a `clinical_record.id`. Scoped the same way the `clinical-records`
 * entity is: the caller must own the record or have an appointment with that patient,
 * unless their resolved scope bypasses row-level filtering (superadmin). Previously
 * unscoped — any authenticated user could list/download/upload/delete any patient's
 * documents by id (IDOR, found in a full-app security audit).
 *
 * @param {string}                   rawPath      Normalized request path.
 * @param {string}                   method       HTTP method.
 * @param {import('pg').PoolClient}  client       Active DB client.
 * @param {object}                   tokenPayload Verified JWT payload.
 */
export async function handleDocuments(rawPath, method, client, tokenPayload) {
  const docsMatch = rawPath.match(/^\/api\/documents\/(\d+)(\/(.+))?$/);
  if (!docsMatch) return null;

  const log      = getLogger();
  const recordId = docsMatch[1];
  const subPath  = docsMatch[3] ?? null;
  const prefix   = `${DOCS_PREFIX}/${recordId}/`;

  const profScope = await profScopeService.resolveProfScope(client, tokenPayload.sub, tokenPayload.role);
  const { clause, params } = profScopeService.buildProfWhere(
    { profFilter: { idCol: 'c.professional_id', existsIn: { table: 'appointment', patientCol: 'patient_id', profCol: 'professional_id', pkCol: 'patient_id' } } },
    profScope, 1
  );
  const andOrWhere = clause ? clause.replace(' WHERE ', ' AND ') : '';
  const owns = await client.query(
    `SELECT 1 FROM clinical_record c WHERE c.id = $1${andOrWhere} LIMIT 1`,
    [recordId, ...params]
  );
  if (owns.rowCount === 0) {
    log.warn('Documents access denied — record not owned by caller', { recordId, sub: tokenPayload.sub });
    return response(404, { message: 'Registro no encontrado' });
  }

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

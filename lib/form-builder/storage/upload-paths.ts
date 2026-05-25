// lib/form-builder/storage/upload-paths.ts
// 888 Safety & Training Platform
//
// Pure path-builder helpers for the form-media Supabase Storage bucket.
// These functions produce the storage paths that feed into uploadMediaAction.
// They contain NO I/O — they are string builders only.
//
// Security note (T-14-01-04): clientId, submissionId, and fieldId MUST come
// from server-side data (RSC fetches them from the DB), never from raw user input.
// The path prefix is load-bearing for the form-media RLS folder-scoping policy
// (migration 001: storage.foldername(name))[1] matched against caller's client_id).

const VALID_PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
type PhotoExtension = (typeof VALID_PHOTO_EXTENSIONS)[number];

interface SignaturePathParams {
  clientId: string;
  submissionId: string;
  fieldId: string;
}

interface PhotoPathParams {
  clientId: string;
  submissionId: string;
  fieldId: string;
  uuid: string;
  ext: PhotoExtension;
}

/**
 * D-16: Build the Supabase Storage path for a signature PNG.
 * Path format: {clientId}/signatures/{submissionId}/{fieldId}.png
 *
 * All three path-segment inputs are validated non-empty because the path
 * prefix is load-bearing for the RLS folder-scoping policy in migration 001.
 */
export function buildSignatureStoragePath({
  clientId,
  submissionId,
  fieldId,
}: SignaturePathParams): string {
  if (!clientId) throw new Error("upload-paths: clientId is required");
  if (!submissionId) throw new Error("upload-paths: submissionId is required");
  if (!fieldId) throw new Error("upload-paths: fieldId is required");

  return `${clientId}/signatures/${submissionId}/${fieldId}.png`;
}

/**
 * D-17: Build the Supabase Storage path for a photo upload.
 * Path format: {clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}
 *
 * Extensions are limited to the image whitelist (T-14-01-04 security gate).
 * All path-segment inputs are validated non-empty (same RLS reason as above).
 */
export function buildPhotoStoragePath({
  clientId,
  submissionId,
  fieldId,
  uuid,
  ext,
}: PhotoPathParams): string {
  if (!clientId) throw new Error("upload-paths: clientId is required");
  if (!submissionId) throw new Error("upload-paths: submissionId is required");
  if (!fieldId) throw new Error("upload-paths: fieldId is required");

  if (!VALID_PHOTO_EXTENSIONS.includes(ext as PhotoExtension)) {
    throw new Error(
      `upload-paths: invalid photo extension '${ext}'. Must be one of: ${VALID_PHOTO_EXTENSIONS.join(", ")}.`
    );
  }

  return `${clientId}/photos/${submissionId}/${fieldId}/${uuid}.${ext}`;
}

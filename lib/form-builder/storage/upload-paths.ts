/**
 * Storage path helpers for form-media uploads.
 *
 * D-16: Signature path  → {clientId}/signatures/{submissionId}/{fieldId}.png
 * D-17: Photo path      → {clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}
 *
 * These helpers are PURE string builders — no I/O.
 * uploadMediaAction in app/admin/assessments/actions.ts composes them.
 *
 * SECURITY NOTE: clientId / submissionId / fieldId MUST come from server-side
 * data (RSC fetches from DB), never from raw user input. The path prefix is
 * load-bearing for the form-media RLS folder-scoping policy (migration 001).
 */

/** Valid file extensions for photo uploads. */
type PhotoExtension = "jpg" | "jpeg" | "png" | "webp";

const VALID_PHOTO_EXTENSIONS: readonly PhotoExtension[] = [
  "jpg",
  "jpeg",
  "png",
  "webp",
];

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
 * Build the storage path for a signature file (D-16).
 * Path: {clientId}/signatures/{submissionId}/{fieldId}.png
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
 * Build the storage path for a photo file (D-17).
 * Path: {clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}
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
  if (!uuid) throw new Error("upload-paths: uuid is required");
  if (!VALID_PHOTO_EXTENSIONS.includes(ext)) {
    throw new Error(`upload-paths: invalid photo extension '${ext}'`);
  }
  return `${clientId}/photos/${submissionId}/${fieldId}/${uuid}.${ext}`;
}

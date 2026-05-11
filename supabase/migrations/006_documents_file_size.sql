-- 006_documents_file_size.sql
-- Add file_size_bytes to documents so the compliance UI can show file size
-- without joining storage.objects on every list query.
--
-- The upload UI (Phase 1 Task 4 of the May 2026 milestone) will populate this
-- at upload time from the File.size on the client. Existing rows remain NULL
-- and render as "—" in the UI.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

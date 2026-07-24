/**
 * Returns the canonical public site URL used in client-facing links (signing
 * URLs, assignment links, etc.).
 *
 * VERCEL_URL is intentionally excluded: it resolves to the per-deployment
 * preview URL (e.g. project-abc123.vercel.app), never the production domain.
 * Using it in signing links would break clients on the stable domain and would
 * silently serve tokens from the wrong origin on preview deploys.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    // Unset env: localhost only under `next dev` — a production/preview build
    // missing the var must still emit links on the real customer domain, never
    // localhost (dead links) or the per-deploy vercel.app origin.
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.merlinsafetysystem.com")
  // Strip any trailing slash so callers can safely append paths with a leading /
  return raw.replace(/\/$/, "")
}

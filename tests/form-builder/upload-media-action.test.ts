/**
 * Tests for uploadMediaAction (app/admin/assessments/actions.ts)
 *
 * Security contract (T-14-03-01..T-14-03-05):
 * - Auth gate: requireActorUserId("admin") is the FIRST statement in the action body
 * - MIME whitelist: only image/png, image/jpeg, image/webp accepted
 * - Size caps: signature ≤ 500KB, photo ≤ 2MB
 * - Storage path matches D-16 (signature) / D-17 (photo) via upload-paths helpers
 * - Every successful upload writes a field_media row
 *
 * Vitest + JSDOM; no real Supabase or auth — all I/O is mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal base64 data URL of approximately `sizeBytes` bytes. */
function makeDataUrl(mimeType: string, sizeBytes: number): string {
  // Each base64 character encodes 6 bits → 3 bytes per 4 chars
  // We need sizeBytes of decoded data → ceil(sizeBytes * 4 / 3) base64 chars
  const base64Length = Math.ceil((sizeBytes * 4) / 3);
  const base64 = "A".repeat(base64Length);
  return `data:${mimeType};base64,${base64}`;
}

const VALID_CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const VALID_SUBMISSION_ID = "22222222-2222-2222-2222-222222222222";
const VALID_FIELD_ID = "33333333-3333-3333-3333-333333333333";

// ── Mock setup ───────────────────────────────────────────────────────────────

// Mock @/lib/auth-helpers. uploadMediaAction now gates via authorizeSubmissionAccess
// (admin OR owning client), so isAdmin/getClientContext must be mocked. Default: admin.
const mockIsAdmin = vi.fn().mockResolvedValue(true);
const mockGetClientContext = vi
  .fn()
  .mockResolvedValue({ client_id: "11111111-1111-1111-1111-111111111111" });
vi.mock("@/lib/auth-helpers", () => ({
  requireActorUserId: vi.fn().mockResolvedValue("mock-admin-user-id"),
  getActorUserId: vi.fn().mockResolvedValue("mock-admin-user-id"),
  isAdmin: () => mockIsAdmin(),
  getClientContext: () => mockGetClientContext(),
}));

// Mock next/cache and next/server so "use server" helpers don't fail
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn((fn: () => unknown) => fn()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// Mock ai and @ai-sdk/openai
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn() }));

// Mock @/lib/supabase/server
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
  }),
}));

// Track upload calls and insert calls
const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "" } }),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "field_media") {
        return { insert: mockInsert };
      }
      if (table === "form_submissions") {
        // authorizeSubmissionAccess looks up the owning org by submission id.
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { client_id: "11111111-1111-1111-1111-111111111111" },
            error: null,
          }),
        };
      }
      // Default stub for other tables
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockReturnThis(),
      };
    }),
  },
}));

// ── Structural assertion: auth gate is the FIRST statement ──────────────────

describe("uploadMediaAction — structural auth gate assertion (T-14-03-01)", () => {
  it("gates on submission ownership and derives clientId from the submission (not the caller arg)", () => {
    const actionsPath = path.resolve(
      __dirname,
      "../../app/admin/assessments/actions.ts"
    );
    const source = fs.readFileSync(actionsPath, "utf8");

    // Check the function is exported
    expect(source).toMatch(/export\s+async\s+function\s+uploadMediaAction/);

    // Extract the uploadMediaAction body from source
    const fnMatch = source.match(
      /export\s+async\s+function\s+uploadMediaAction[\s\S]*?\n\}/
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];

    // The ownership gate (admin OR owning client) must be present, and the
    // authoritative clientId must be DERIVED from it — never trusted from the
    // caller-supplied arg (which would allow writing into another org's folder).
    expect(fnBody).toMatch(/authorizeSubmissionAccess\(\s*submissionId\s*\)/);
    expect(fnBody).toMatch(/clientId\s*=\s*await\s+authorizeSubmissionAccess/);

    // The gate must run before any storage upload.
    const gatePos = fnBody.indexOf("authorizeSubmissionAccess");
    const uploadPos = fnBody.indexOf(".upload(");
    expect(gatePos).toBeGreaterThan(-1);
    expect(gatePos).toBeLessThan(uploadPos);
  });

  it("source file contains adminClient.from('field_media').insert", () => {
    const actionsPath = path.resolve(
      __dirname,
      "../../app/admin/assessments/actions.ts"
    );
    const source = fs.readFileSync(actionsPath, "utf8");
    expect(source).toMatch(/from\s*\(\s*["']field_media["']\s*\)/);
  });

  it("source file contains adminClient.storage.from('form-media')", () => {
    const actionsPath = path.resolve(
      __dirname,
      "../../app/admin/assessments/actions.ts"
    );
    const source = fs.readFileSync(actionsPath, "utf8");
    expect(source).toMatch(/from\s*\(\s*["']form-media["']\s*\)/);
  });
});

// ── Functional tests (action imported after mocks are in place) ──────────────

describe("uploadMediaAction — MIME whitelist enforcement (T-14-03-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("rejects application/octet-stream with 'Unsupported MIME type'", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("application/octet-stream", 1000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "photo"
      )
    ).rejects.toThrow(/Unsupported MIME type/i);
  });

  it("rejects text/html with 'Unsupported MIME type'", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("text/html", 1000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "photo"
      )
    ).rejects.toThrow(/Unsupported MIME type/i);
  });

  it("rejects image/svg+xml with 'Unsupported MIME type' (SVG can carry JS)", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/svg+xml", 1000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "photo"
      )
    ).rejects.toThrow(/Unsupported MIME type/i);
  });

  it("accepts image/png without throwing", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/png", 100_000); // 100KB — within limits
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "signature"
      )
    ).resolves.toBeDefined();
  });

  it("accepts image/jpeg without throwing", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/jpeg", 1_000_000); // 1MB — within photo limit
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "photo"
      )
    ).resolves.toBeDefined();
  });

  it("accepts image/webp without throwing", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/webp", 500_000); // 500KB — within limits
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "photo"
      )
    ).resolves.toBeDefined();
  });
});

describe("uploadMediaAction — size cap enforcement (T-14-03-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("rejects a 600KB PNG signature with 'Signature too large'", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    // 600KB decoded data → base64 is ~800KB but we're testing decoded buffer size
    const dataUrl = makeDataUrl("image/png", 600_000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "signature"
      )
    ).rejects.toThrow(/Signature too large/i);
  });

  it("accepts a 100KB PNG signature", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/png", 100_000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "signature"
      )
    ).resolves.toBeDefined();
  });

  it("rejects a 2.5MB JPEG photo with 'Photo too large'", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/jpeg", 2_500_000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "photo"
      )
    ).rejects.toThrow(/Photo too large/i);
  });

  it("accepts a 1.5MB JPEG photo", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/jpeg", 1_500_000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "photo"
      )
    ).resolves.toBeDefined();
  });
});

describe("uploadMediaAction — path composition (D-16 / D-17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("signature path matches D-16: {clientId}/signatures/{submissionId}/{fieldId}.png", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/png", 100_000);
    const result = await uploadMediaAction(
      VALID_SUBMISSION_ID,
      VALID_FIELD_ID,
      dataUrl,
      "image",
      VALID_CLIENT_ID,
      "signature"
    );
    expect(result).toBe(
      `${VALID_CLIENT_ID}/signatures/${VALID_SUBMISSION_ID}/${VALID_FIELD_ID}.png`
    );
    // Verify the upload call used this path
    expect(mockUpload).toHaveBeenCalledWith(
      `${VALID_CLIENT_ID}/signatures/${VALID_SUBMISSION_ID}/${VALID_FIELD_ID}.png`,
      expect.any(Buffer),
      expect.objectContaining({ upsert: true })
    );
  });

  it("photo path matches D-17: {clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/jpeg", 1_000_000);
    const result = await uploadMediaAction(
      VALID_SUBMISSION_ID,
      VALID_FIELD_ID,
      dataUrl,
      "image",
      VALID_CLIENT_ID,
      "photo"
    );
    // D-17 path structure
    expect(result).toMatch(
      new RegExp(
        `^${VALID_CLIENT_ID}/photos/${VALID_SUBMISSION_ID}/${VALID_FIELD_ID}/[0-9a-f-]{36}\\.jpg$`
      )
    );
    // Photos use upsert: false (UUID guarantees uniqueness)
    expect(mockUpload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.objectContaining({ upsert: false })
    );
  });
});

describe("uploadMediaAction — field_media row insert (FOUND-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("inserts a field_media row after successful upload", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/png", 100_000);
    await uploadMediaAction(
      VALID_SUBMISSION_ID,
      VALID_FIELD_ID,
      dataUrl,
      "image",
      VALID_CLIENT_ID,
      "signature"
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        submission_id: VALID_SUBMISSION_ID,
        field_id: VALID_FIELD_ID,
        storage_path: `${VALID_CLIENT_ID}/signatures/${VALID_SUBMISSION_ID}/${VALID_FIELD_ID}.png`,
        media_type: "image",
      })
    );
  });

  it("does NOT insert field_media row when upload fails", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    mockUpload.mockResolvedValue({ error: { message: "bucket error" } });
    const dataUrl = makeDataUrl("image/png", 100_000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "signature"
      )
    ).rejects.toThrow(/Storage upload failed/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("uploadMediaAction — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("rejects a caller who is neither admin nor the owning client (IDOR gate)", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    // Not an admin, and the caller's org differs from the submission's owner.
    mockIsAdmin.mockResolvedValueOnce(false);
    mockGetClientContext.mockResolvedValueOnce({ client_id: "99999999-9999-9999-9999-999999999999" });
    const dataUrl = makeDataUrl("image/png", 100_000);
    await expect(
      uploadMediaAction(VALID_SUBMISSION_ID, VALID_FIELD_ID, dataUrl, "image", VALID_CLIENT_ID, "signature")
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("rejects empty submissionId", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/png", 100_000);
    await expect(
      uploadMediaAction("", VALID_FIELD_ID, dataUrl, "image", VALID_CLIENT_ID, "signature")
    ).rejects.toThrow();
  });

  it("rejects empty fieldId", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/png", 100_000);
    await expect(
      uploadMediaAction(VALID_SUBMISSION_ID, "", dataUrl, "image", VALID_CLIENT_ID, "signature")
    ).rejects.toThrow();
  });

  it("rejects non-PNG for signature kind", async () => {
    const { uploadMediaAction } = await import(
      "@/app/admin/assessments/actions"
    );
    const dataUrl = makeDataUrl("image/jpeg", 100_000);
    await expect(
      uploadMediaAction(
        VALID_SUBMISSION_ID,
        VALID_FIELD_ID,
        dataUrl,
        "image",
        VALID_CLIENT_ID,
        "signature"
      )
    ).rejects.toThrow(/Signatures must be PNG/i);
  });
});

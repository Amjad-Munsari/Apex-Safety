import { describe, it, expect } from "vitest";

// Tests for the storage-path helper module (lib/form-builder/storage/upload-paths.ts).
// RED-first TDD — written before the implementation exists.
// D-16: signature path = {clientId}/signatures/{submissionId}/{fieldId}.png
// D-17: photo path = {clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}

describe("buildSignatureStoragePath (D-16)", () => {
  it("produces the exact D-16 path format", async () => {
    const { buildSignatureStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    const result = buildSignatureStoragePath({
      clientId: "client-123",
      submissionId: "sub-456",
      fieldId: "field-789",
    });
    expect(result).toBe("client-123/signatures/sub-456/field-789.png");
  });

  it("throws when clientId is empty", async () => {
    const { buildSignatureStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    expect(() =>
      buildSignatureStoragePath({ clientId: "", submissionId: "sub-456", fieldId: "field-789" })
    ).toThrow();
  });

  it("throws when submissionId is empty", async () => {
    const { buildSignatureStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    expect(() =>
      buildSignatureStoragePath({ clientId: "client-123", submissionId: "", fieldId: "field-789" })
    ).toThrow();
  });

  it("throws when fieldId is empty", async () => {
    const { buildSignatureStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    expect(() =>
      buildSignatureStoragePath({ clientId: "client-123", submissionId: "sub-456", fieldId: "" })
    ).toThrow();
  });
});

describe("buildPhotoStoragePath (D-17)", () => {
  it("produces the exact D-17 path format with .jpg extension", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    const result = buildPhotoStoragePath({
      clientId: "client-123",
      submissionId: "sub-456",
      fieldId: "field-789",
      uuid: "abc-uuid",
      ext: "jpg",
    });
    expect(result).toBe("client-123/photos/sub-456/field-789/abc-uuid.jpg");
  });

  it("accepts .jpeg extension", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    const result = buildPhotoStoragePath({
      clientId: "client-123",
      submissionId: "sub-456",
      fieldId: "field-789",
      uuid: "my-uuid",
      ext: "jpeg",
    });
    expect(result).toBe("client-123/photos/sub-456/field-789/my-uuid.jpeg");
  });

  it("accepts .png extension", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    const result = buildPhotoStoragePath({
      clientId: "client-123",
      submissionId: "sub-456",
      fieldId: "field-789",
      uuid: "my-uuid",
      ext: "png",
    });
    expect(result).toBe("client-123/photos/sub-456/field-789/my-uuid.png");
  });

  it("accepts .webp extension", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    const result = buildPhotoStoragePath({
      clientId: "client-123",
      submissionId: "sub-456",
      fieldId: "field-789",
      uuid: "my-uuid",
      ext: "webp",
    });
    expect(result).toBe("client-123/photos/sub-456/field-789/my-uuid.webp");
  });

  it("rejects an invalid extension (security gate — T-14-01-04)", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    expect(() =>
      buildPhotoStoragePath({
        clientId: "client-123",
        submissionId: "sub-456",
        fieldId: "field-789",
        uuid: "my-uuid",
        ext: "exe" as "jpg",
      })
    ).toThrow();
  });

  it("throws when clientId is empty", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    expect(() =>
      buildPhotoStoragePath({
        clientId: "",
        submissionId: "sub-456",
        fieldId: "field-789",
        uuid: "my-uuid",
        ext: "jpg",
      })
    ).toThrow();
  });

  it("throws when submissionId is empty", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    expect(() =>
      buildPhotoStoragePath({
        clientId: "client-123",
        submissionId: "",
        fieldId: "field-789",
        uuid: "my-uuid",
        ext: "jpg",
      })
    ).toThrow();
  });

  it("throws when fieldId is empty", async () => {
    const { buildPhotoStoragePath } = await import(
      "@/lib/form-builder/storage/upload-paths"
    );
    expect(() =>
      buildPhotoStoragePath({
        clientId: "client-123",
        submissionId: "sub-456",
        fieldId: "",
        uuid: "my-uuid",
        ext: "jpg",
      })
    ).toThrow();
  });
});

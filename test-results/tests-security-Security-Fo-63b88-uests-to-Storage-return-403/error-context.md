# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\security.spec.ts >> Security Foundation >> Unauthenticated requests to Storage return 403
- Location: tests\security.spec.ts:4:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 403
Received: 400
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test"
  2  | 
  3  | test.describe("Security Foundation", () => {
  4  |   test("Unauthenticated requests to Storage return 403", async ({ request }) => {
  5  |     // Attempting to access a private bucket without a signed URL or session
  6  |     // Replace with actual Supabase project URL if available
  7  |     const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321"
  8  |     const storageUrl = `${supabaseUrl}/storage/v1/object/client-documents/secret.pdf`
  9  |     
  10 |     const response = await request.get(storageUrl)
> 11 |     expect(response.status()).toBe(403)
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  12 |   })
  13 | 
  14 |   test("Cross-tenant RLS isolation", async () => {
  15 |     // This would typically be a Vitest unit/integration test for the DB 
  16 |     // but we can scaffold the intent here.
  17 |     // Logic: 
  18 |     // 1. Sign in as Client A
  19 |     // 2. Query 'documents'
  20 |     // 3. Assert all rows belong to Client A
  21 |   })
  22 | 
  23 |   test("Admin service role restricted to server-side", async () => {
  24 |     // This is a build-time check enforced by 'server-only'
  25 |     // We can't easily test this at runtime with Playwright 
  26 |     // but the presence of the import is the guard.
  27 |   })
  28 | })
  29 | 
```
// Tests for the email outbox and its bounded retry (lib/notifications/outbox.ts,
// reached through dispatchNotification).
//
// Three properties are worth defending here, and every test below belongs to one
// of them:
//
//   1. Classification — a transient blip is retried, a hard rejection never is.
//   2. Idempotency — no path, inline or explicit, can produce two emails for one
//      logical send.
//   3. Lifecycle — every attempt leaves a truthful row, successes included.
//
// The Supabase table is faked rather than mocked call-by-call, because the
// interesting behaviour *is* the row transitions: the unique index on
// idempotency_key and the compare-and-swap on status are what stop double-sends,
// so the fake honours both.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// ── Resend transport ─────────────────────────────────────────────────────────

// A real class, not vi.fn().mockImplementation(): restoreAllMocks() in afterEach
// would strip the implementation off a mock constructor and every test after the
// first would get `undefined` back from `new Resend(...)`.
const sendSpy = vi.fn()
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => sendSpy(...args) }
  },
}))

// ── Fake email_outbox table ──────────────────────────────────────────────────

type Row = Record<string, unknown>

const store: { rows: Row[]; seq: number; throwOnAccess: boolean } = {
  rows: [],
  seq: 0,
  throwOnAccess: false,
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([column, value]) => row[column] === value)
}

function insertBuilder(values: Row) {
  const run = async () => {
    const key = values.idempotency_key
    if (key && store.rows.some((row) => row.idempotency_key === key)) {
      return {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      }
    }
    store.seq += 1
    const row: Row = { id: `outbox-${store.seq}`, sent_at: null, ...values }
    store.rows.push(row)
    return { data: { id: row.id }, error: null }
  }
  return { select: () => ({ single: run }) }
}

function selectBuilder() {
  const filters: Array<[string, unknown]> = []
  const chain = {
    eq(column: string, value: unknown) {
      filters.push([column, value])
      return chain
    },
    async maybeSingle() {
      const found = store.rows.find((row) => matches(row, filters))
      return { data: found ? { ...found } : null, error: null }
    },
  }
  return chain
}

function updateBuilder(patch: Row) {
  const filters: Array<[string, unknown]> = []
  let applied: Row[] | null = null

  const apply = () => {
    if (applied) return applied
    applied = store.rows.filter((row) => matches(row, filters))
    for (const row of applied) Object.assign(row, patch)
    return applied
  }

  const chain = {
    eq(column: string, value: unknown) {
      filters.push([column, value])
      return chain
    },
    select() {
      return chain
    },
    // Thenable so both `await update().eq(...)` and
    // `await update().eq(...).select(...)` behave like the real client.
    then<T>(resolve: (value: { data: Row[]; error: null }) => T) {
      return Promise.resolve(resolve({ data: apply().map((row) => ({ ...row })), error: null }))
    },
  }
  return chain
}

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (store.throwOnAccess) throw new Error("supabase unreachable")
      if (table === "email_outbox") {
        return {
          insert: (values: Row) => insertBuilder(values),
          select: () => selectBuilder(),
          update: (patch: Row) => updateBuilder(patch),
        }
      }
      // app_error_log / workflow_errors writes from the logger.
      return { insert: async () => ({ error: null }) }
    },
  },
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SIGNED_PAYLOAD = {
  type: "proposal_signed" as const,
  client_name: "Acme Ltd",
  client_email: "contact@acme.example",
  proposal_title: "Fire Risk Assessment",
  signed_at: "2026-07-27T10:00:00.000Z",
}

/** No waiting between attempts — the backoff itself is not under test. */
const NO_WAIT = { backoffMs: [0, 0] }

function outboxRow(id?: string): Row {
  const row = id ? store.rows.find((r) => r.id === id) : store.rows[0]
  if (!row) throw new Error("expected an email_outbox row")
  return row
}

async function loadDispatch() {
  return await import("@/lib/notifications/dispatch")
}

async function loadOutbox() {
  return await import("@/lib/notifications/outbox")
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllEnvs()
  store.rows = []
  store.seq = 0
  store.throwOnAccess = false
  vi.stubEnv("RESEND_API_KEY", "re_test_key")
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

// ── 1. Classification ───────────────────────────────────────────────────────

describe("classifyEmailFailure", () => {
  it("treats 4xx rejections as hard — the same request would fail identically", async () => {
    const { classifyEmailFailure } = await loadOutbox()
    expect(classifyEmailFailure({ status: 422, message: "validation_error" })).toBe("hard")
    expect(classifyEmailFailure({ status: 401, message: "API key is invalid" })).toBe("hard")
    expect(classifyEmailFailure({ status: 403, message: "domain is not verified" })).toBe("hard")
  })

  it("treats 408 and 429 as transient even though they are 4xx", async () => {
    const { classifyEmailFailure } = await loadOutbox()
    expect(classifyEmailFailure({ status: 429, message: "rate limit exceeded" })).toBe("transient")
    expect(classifyEmailFailure({ status: 408, message: "request timeout" })).toBe("transient")
  })

  it("treats 5xx and network faults as transient", async () => {
    const { classifyEmailFailure } = await loadOutbox()
    expect(classifyEmailFailure({ status: 503 })).toBe("transient")
    expect(classifyEmailFailure({ message: "fetch failed" })).toBe("transient")
    expect(classifyEmailFailure({ message: "read ECONNRESET" })).toBe("transient")
    expect(classifyEmailFailure({ message: "socket hang up" })).toBe("transient")
  })

  it("classifies from the message when no status came back", async () => {
    const { classifyEmailFailure } = await loadOutbox()
    expect(classifyEmailFailure({ message: "missing/invalid recipient for report_ready" })).toBe("hard")
    expect(classifyEmailFailure({ message: "Invalid `to` field" })).toBe("hard")
    expect(classifyEmailFailure({ name: "validation_error", message: "" })).toBe("hard")
  })

  it("defaults an unrecognised failure to transient — losing an email costs more than a retry", async () => {
    const { classifyEmailFailure } = await loadOutbox()
    expect(classifyEmailFailure({ message: "something nobody has seen before" })).toBe("transient")
    expect(classifyEmailFailure({})).toBe("transient")
  })
})

// ── 2. Lifecycle ────────────────────────────────────────────────────────────

describe("outbox row lifecycle", () => {
  it("records a successful send — the case that previously left no trace at all", async () => {
    sendSpy.mockResolvedValue({ data: { id: "email_1" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, {
      ...NO_WAIT,
      clientId: "11111111-1111-1111-1111-111111111111",
      relatedType: "proposal",
      relatedId: "22222222-2222-2222-2222-222222222222",
    })

    expect(result.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(result.outboxId).toBeTruthy()

    const row = outboxRow(result.outboxId)
    expect(row.status).toBe("sent")
    expect(row.notification_type).toBe("proposal_signed")
    expect(row.recipient).toBe("contact@acme.example")
    expect(row.attempt_count).toBe(1)
    expect(row.sent_at).toBeTruthy()
    expect(row.provider_message_id).toBe("email_1")
    expect(row.last_error).toBeNull()
    expect(row.client_id).toBe("11111111-1111-1111-1111-111111111111")
    expect(row.related_type).toBe("proposal")
  })

  it("retries a transient failure and reports success on the second attempt", async () => {
    sendSpy
      .mockResolvedValueOnce({ data: null, error: { message: "service unavailable", statusCode: 503 } })
      .mockResolvedValueOnce({ data: { id: "email_2" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    expect(result.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(2)
    const row = outboxRow(result.outboxId)
    expect(row.status).toBe("sent")
    expect(row.attempt_count).toBe(2)
  })

  it("never retries a hard rejection and marks the row abandoned", async () => {
    sendSpy.mockResolvedValue({
      data: null,
      error: { message: "Invalid `to` field", name: "validation_error", statusCode: 422 },
    })
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    expect(result.ok).toBe(false)
    expect(result.errorKind).toBe("hard")
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const row = outboxRow(result.outboxId)
    expect(row.status).toBe("abandoned")
    expect(row.last_error_kind).toBe("hard")
    expect(row.attempt_count).toBe(1)
  })

  it("stops after the attempt budget on a transient failure and leaves the row retryable", async () => {
    sendSpy.mockResolvedValue({ data: null, error: { message: "fetch failed" } })
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    expect(result.ok).toBe(false)
    expect(result.errorKind).toBe("transient")
    expect(sendSpy).toHaveBeenCalledTimes(3)
    const row = outboxRow(result.outboxId)
    expect(row.status).toBe("failed")
    expect(row.attempt_count).toBe(3)
    expect(row.last_error).toContain("fetch failed")
  })

  it("honours a caller's smaller attempt budget", async () => {
    sendSpy.mockResolvedValue({ data: null, error: { message: "fetch failed" } })
    const { dispatchNotification } = await loadDispatch()

    await dispatchNotification(SIGNED_PAYLOAD, { ...NO_WAIT, maxAttempts: 1 })

    expect(sendSpy).toHaveBeenCalledTimes(1)
  })

  it("records a missing recipient without contacting the provider at all", async () => {
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification({ ...SIGNED_PAYLOAD, client_email: "" }, NO_WAIT)

    expect(result.ok).toBe(false)
    expect(result.errorKind).toBe("hard")
    expect(sendSpy).not.toHaveBeenCalled()
    const row = outboxRow(result.outboxId)
    expect(row.status).toBe("abandoned")
    expect(row.recipient).toBeNull()
    expect(row.last_error).toContain("missing/invalid recipient")
  })

  it("marks single-use-link emails as not re-sendable", async () => {
    sendSpy.mockResolvedValue({ data: { id: "email_3" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    const invite = await dispatchNotification(
      {
        type: "client_portal_invite",
        client_name: "Acme Ltd",
        recipient_name: "Jane",
        recipient_email: "jane@acme.example",
        invite_url: "https://app.example.com/auth/confirm?token_hash=abc",
        status: "invited",
      },
      NO_WAIT
    )
    const signed = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    expect(outboxRow(invite.outboxId).resend_allowed).toBe(false)
    expect(outboxRow(signed.outboxId).resend_allowed).toBe(true)
  })

  it("delivers the email even when the outbox row cannot be written", async () => {
    store.throwOnAccess = true
    sendSpy.mockResolvedValue({ data: { id: "email_4" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    expect(result.ok).toBe(true)
    expect(result.outboxId).toBeUndefined()
    expect(sendSpy).toHaveBeenCalledTimes(1)
  })
})

// ── 3. Idempotency ──────────────────────────────────────────────────────────

describe("idempotency — one logical email, one send", () => {
  it("does not send again when the same idempotency key was already accepted", async () => {
    sendSpy.mockResolvedValue({ data: { id: "email_5" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    const first = await dispatchNotification(SIGNED_PAYLOAD, {
      ...NO_WAIT,
      idempotencyKey: "proposal_signed:abc",
    })
    const second = await dispatchNotification(SIGNED_PAYLOAD, {
      ...NO_WAIT,
      idempotencyKey: "proposal_signed:abc",
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(second.outboxId).toBe(first.outboxId)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(store.rows).toHaveLength(1)
  })

  it("re-attempts a keyed row that failed transiently, reusing the same row", async () => {
    sendSpy.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } })
    sendSpy.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } })
    sendSpy.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } })
    sendSpy.mockResolvedValue({ data: { id: "email_6" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    const first = await dispatchNotification(SIGNED_PAYLOAD, {
      ...NO_WAIT,
      idempotencyKey: "proposal_signed:def",
    })
    expect(first.ok).toBe(false)

    const second = await dispatchNotification(SIGNED_PAYLOAD, {
      ...NO_WAIT,
      idempotencyKey: "proposal_signed:def",
    })

    expect(second.ok).toBe(true)
    expect(second.outboxId).toBe(first.outboxId)
    expect(store.rows).toHaveLength(1)
    const row = outboxRow(first.outboxId)
    // Three attempts from the first dispatch, one from the second.
    expect(row.attempt_count).toBe(4)
    expect(row.status).toBe("sent")
  })

  it("passes a provider idempotency key on every attempt, even without a caller key", async () => {
    sendSpy.mockResolvedValue({ data: { id: "email_7" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    const options = sendSpy.mock.calls[0][1] as { idempotencyKey?: string }
    expect(options?.idempotencyKey).toBe(`outbox:${result.outboxId}`)
  })

  it("suppresses a duplicate while another attempt holds the claim", async () => {
    sendSpy.mockResolvedValue({ data: { id: "email_8" }, error: null })
    const { dispatchNotification } = await loadDispatch()

    // A row left mid-flight by another process, claimed moments ago.
    store.rows.push({
      id: "outbox-inflight",
      notification_type: "proposal_signed",
      status: "sending",
      attempt_count: 1,
      last_attempt_at: new Date().toISOString(),
      idempotency_key: "proposal_signed:inflight",
      resend_allowed: true,
      payload: SIGNED_PAYLOAD,
    })

    const result = await dispatchNotification(SIGNED_PAYLOAD, {
      ...NO_WAIT,
      idempotencyKey: "proposal_signed:inflight",
    })

    expect(sendSpy).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(result.status).toBe(0)
  })
})

// ── 4. Explicit re-send ─────────────────────────────────────────────────────

describe("retryOutboxEntry", () => {
  async function seedFailedRow(overrides: Row = {}): Promise<string> {
    sendSpy.mockResolvedValue({ data: null, error: { message: "fetch failed" } })
    const { dispatchNotification } = await loadDispatch()
    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)
    const row = outboxRow(result.outboxId)
    Object.assign(row, overrides)
    sendSpy.mockReset()
    return result.outboxId as string
  }

  it("re-sends a failed row and marks it sent", async () => {
    const id = await seedFailedRow()
    sendSpy.mockResolvedValue({ data: { id: "email_9" }, error: null })
    const { retryOutboxEntry } = await loadOutbox()

    const result = await retryOutboxEntry(id)

    expect(result.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const row = outboxRow(id)
    expect(row.status).toBe("sent")
    expect(row.attempt_count).toBe(4)
    expect(row.provider_message_id).toBe("email_9")
  })

  it("never re-sends a row the provider already accepted", async () => {
    const id = await seedFailedRow({ status: "sent", sent_at: new Date().toISOString() })
    const { retryOutboxEntry } = await loadOutbox()

    const result = await retryOutboxEntry(id)

    expect(result.ok).toBe(true)
    expect(result.refusal).toBe("already_sent")
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("refuses a row another attempt is working on", async () => {
    const id = await seedFailedRow({
      status: "sending",
      last_attempt_at: new Date().toISOString(),
    })
    const { retryOutboxEntry } = await loadOutbox()

    const result = await retryOutboxEntry(id)

    expect(result.ok).toBe(false)
    expect(result.refusal).toBe("in_progress")
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("sends once when two operators retry the same row at the same moment", async () => {
    const id = await seedFailedRow()
    sendSpy.mockResolvedValue({ data: { id: "email_10" }, error: null })
    const { retryOutboxEntry } = await loadOutbox()

    const [a, b] = await Promise.all([retryOutboxEntry(id), retryOutboxEntry(id)])

    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    expect([a.refusal, b.refusal]).toContain("in_progress")
  })

  it("refuses emails carrying a single-use link — the stored link may be spent", async () => {
    const id = await seedFailedRow({ resend_allowed: false })
    const { retryOutboxEntry } = await loadOutbox()

    const result = await retryOutboxEntry(id)

    expect(result.ok).toBe(false)
    expect(result.refusal).toBe("resend_not_allowed")
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("refuses a row whose payload retention has already cleared it", async () => {
    const id = await seedFailedRow({ payload: {} })
    const { retryOutboxEntry } = await loadOutbox()

    const result = await retryOutboxEntry(id)

    expect(result.ok).toBe(false)
    expect(result.refusal).toBe("payload_unavailable")
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("reports not_found for an id that is not in the table", async () => {
    const { retryOutboxEntry } = await loadOutbox()
    const result = await retryOutboxEntry("33333333-3333-3333-3333-333333333333")
    expect(result.ok).toBe(false)
    expect(result.refusal).toBe("not_found")
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("retries a hard-failed row once when an operator asks explicitly", async () => {
    // Automatic retry never touches these; a human who has just fixed the API
    // key is entitled to ask again, and the row records the fresh outcome.
    const id = await seedFailedRow({ status: "abandoned", last_error_kind: "hard" })
    sendSpy.mockResolvedValue({ data: { id: "email_11" }, error: null })
    const { retryOutboxEntry } = await loadOutbox()

    const result = await retryOutboxEntry(id)

    expect(result.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(outboxRow(id).status).toBe("sent")
  })

  it("leaves a still-hard row abandoned after an explicit retry, with one attempt only", async () => {
    const id = await seedFailedRow({ status: "abandoned", last_error_kind: "hard" })
    sendSpy.mockResolvedValue({
      data: null,
      error: { message: "API key is invalid", statusCode: 401 },
    })
    const { retryOutboxEntry } = await loadOutbox()

    const result = await retryOutboxEntry(id)

    expect(result.ok).toBe(false)
    expect(result.errorKind).toBe("hard")
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(outboxRow(id).status).toBe("abandoned")
  })
})

// ── 5. Non-production no-op ─────────────────────────────────────────────────

describe("no provider configured", () => {
  it("records a skipped row outside production instead of pretending to send", async () => {
    vi.unstubAllEnvs()
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    expect(result.ok).toBe(true)
    expect(sendSpy).not.toHaveBeenCalled()
    expect(outboxRow(result.outboxId).status).toBe("skipped")
  })

  it("abandons the send in production when the key is missing", async () => {
    vi.unstubAllEnvs()
    vi.stubEnv("NODE_ENV", "production")
    const { dispatchNotification } = await loadDispatch()

    const result = await dispatchNotification(SIGNED_PAYLOAD, NO_WAIT)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("RESEND_API_KEY")
    expect(sendSpy).not.toHaveBeenCalled()
    const row = outboxRow(result.outboxId)
    expect(row.status).toBe("abandoned")
    expect(row.last_error_kind).toBe("hard")
  })
})

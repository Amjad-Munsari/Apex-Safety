/**
 * Redaction and size-capping for anything on its way into `app_error_log`.
 *
 * An error log is the one place where secrets leak by accident: a failed
 * PayPal call wants to log its request, a failed Supabase call wants to log its
 * headers, and a stack frame can carry an interpolated token. Everything here
 * assumes the caller is careless and the payload is hostile.
 *
 * Two independent guards, because either alone fails:
 *   - key-based: any key that *names* a credential is replaced wholesale, so a
 *     value we've never seen the shape of still can't escape.
 *   - value-based: any string that *looks* like a known credential is masked
 *     even under an innocent key, which is how tokens actually escape (an error
 *     message containing a URL with a token in the query string).
 *
 * Pure, dependency-free and synchronous so it can run inside a catch block that
 * must not itself throw.
 */

/** Keys whose value is dropped regardless of what it contains. */
const SECRET_KEY_PATTERN =
  /(secret|password|passwd|token|credential|api[-_ ]?key|auth|cookie|session|signature|private[-_ ]?key|client[-_ ]?secret|service[-_ ]?role|bearer|otp|pin)/i

/**
 * Keys that merely *sound* secret but carry no credential and are the most
 * useful correlation values we have. Checked before SECRET_KEY_PATTERN.
 */
const SECRET_KEY_ALLOWLIST = /^(token_used|signing_token_used|tokenExpiresAt|authorType|authorName)$/i

/** Value shapes that are credentials wherever they appear. */
const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /\bsk-or-v1-[A-Za-z0-9]{16,}/g,            // OpenRouter
  /\bsk-[A-Za-z0-9]{20,}/g,                  // OpenAI-style
  /\bre_[A-Za-z0-9_-]{16,}/g,                // Resend
  /\bsbp_[A-Za-z0-9]{16,}/g,                 // Supabase management token
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,   // Authorization header value
  /\bBasic\s+[A-Za-z0-9+/]{16,}=*/gi,
  /\b(access|refresh|id)_token=[^&\s"']+/gi, // token in a URL query string
  /\bapikey=[^&\s"']+/gi,
]

export const REDACTED = "[redacted]"

/** Hard caps. Chosen so a single pathological error can't dominate the table. */
export const LIMITS = {
  string: 2_000,
  stack: 20_000,
  message: 4_000,
  arrayItems: 50,
  objectKeys: 60,
  depth: 6,
  totalContextBytes: 16_000,
} as const

/** Masks credential-shaped substrings inside a single string. */
export function redactString(value: string): string {
  let out = value
  for (const pattern of SECRET_VALUE_PATTERNS) {
    // Fresh lastIndex per call: these are module-level /g regexes.
    pattern.lastIndex = 0
    out = out.replace(pattern, REDACTED)
  }
  return out
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}… [truncated ${value.length - max} chars]`
}

/** Redacts a string and caps its length. */
export function safeString(value: string, max: number = LIMITS.string): string {
  return truncate(redactString(value), max)
}

function isSecretKey(key: string): boolean {
  if (SECRET_KEY_ALLOWLIST.test(key)) return false
  return SECRET_KEY_PATTERN.test(key)
}

/**
 * Recursively redacts a value for storage. Cycles, class instances, functions,
 * bigints and symbols are all handled — `JSON.stringify` throws on some of
 * these, and a logger that throws is worse than no logger.
 */
export function redactValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (value === null || value === undefined) return value

  switch (typeof value) {
    case "string":
      return safeString(value)
    case "number":
      return Number.isFinite(value) ? value : String(value)
    case "boolean":
      return value
    case "bigint":
      return `${value.toString()}n`
    case "function":
      return `[function ${value.name || "anonymous"}]`
    case "symbol":
      return value.toString()
  }

  if (depth >= LIMITS.depth) return "[max depth]"

  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: safeString(value.message, LIMITS.message),
      stack: value.stack ? safeString(value.stack, LIMITS.stack) : undefined,
    }
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) return "[circular]"
    seen.add(value as object)

    if (Array.isArray(value)) {
      const items = value.slice(0, LIMITS.arrayItems).map((item) => redactValue(item, depth + 1, seen))
      if (value.length > LIMITS.arrayItems) {
        items.push(`[${value.length - LIMITS.arrayItems} more items]`)
      }
      return items
    }

    const out: Record<string, unknown> = {}
    let count = 0
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (count >= LIMITS.objectKeys) {
        out["[truncated]"] = `${Object.keys(value as object).length - count} more keys`
        break
      }
      out[key] = isSecretKey(key) ? REDACTED : redactValue(item, depth + 1, seen)
      count += 1
    }
    return out
  }

  return String(value)
}

/**
 * Produces the JSON object stored in `app_error_log.context`: fully redacted and
 * guaranteed to serialise within the byte cap. Returns a marker object rather
 * than throwing if the input defeats serialisation entirely.
 */
export function buildContext(input: unknown): Record<string, unknown> {
  if (input === null || input === undefined) return {}
  try {
    const redacted = redactValue(input)
    const shaped: Record<string, unknown> =
      typeof redacted === "object" && redacted !== null && !Array.isArray(redacted)
        ? (redacted as Record<string, unknown>)
        : { value: redacted }

    const serialised = JSON.stringify(shaped)
    if (serialised.length <= LIMITS.totalContextBytes) return shaped

    return {
      truncated: true,
      reason: `context exceeded ${LIMITS.totalContextBytes} bytes`,
      preview: serialised.slice(0, LIMITS.totalContextBytes),
    }
  } catch (err) {
    return {
      contextSerialisationFailed: true,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Header allowlist — everything else is dropped, not redacted. */
const SAFE_HEADERS = new Set([
  "user-agent",
  "referer",
  "content-type",
  "accept-language",
  "x-forwarded-for",
  "x-vercel-id",
  "x-request-id",
])

export function safeHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): Record<string, string> {
  if (!headers) return {}
  const out: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.toLowerCase()
    if (!SAFE_HEADERS.has(key) || rawValue === undefined) continue
    const value = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue
    out[key] = safeString(value, 300)
  }
  return out
}

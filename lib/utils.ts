import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Message carried by an unknown thrown value, or null when it carries none.
 * Server actions reject with real Errors, but a `throw`n plain object or a
 * non-object rejection is always possible, so callers get null rather than
 * "[object Object]" and can fall back to their own copy:
 * `toast.error(errorMessage(err) || "Failed to save")`.
 */
export function errorMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message || null
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === "string") return message || null
  }
  return null
}

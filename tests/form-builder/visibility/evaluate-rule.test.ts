// Phase 15 Wave-0 stub — populated by Wave 1+
// Plan 15-02 Task 1 fills in the real assertions.
import { describe, it } from "vitest";

// NOTE: Do NOT statically import production modules — Wave 1 tasks add
// the `await import("@/lib/form-builder/visibility/...")` calls when they implement.
// See tests/form-builder/attributes.test.ts for the dynamic-import convention.

describe("evaluateRule — operator matrix", () => {
  it.todo("equals: returns true when source value matches rule value");
  it.todo("notEquals: returns true when source value does not match rule value");
  it.todo("contains: returns true when source string contains rule value");
  it.todo("greaterThan: returns true when source number is greater than rule value");
  it.todo("lessThan: returns true when source number is less than rule value");
  it.todo("isEmpty: returns true when source value is empty (undefined, null, empty string, empty array)");
  it.todo("isNotEmpty: returns true when source value is non-empty");
});

describe("evaluateRule — source type matrix", () => {
  it.todo("text field source: operator evaluated against string value");
  it.todo("number field source: operator evaluated against numeric value");
  it.todo("select field source: operator evaluated against selected option value");
  it.todo("checkbox field source: operator evaluated against boolean value");
  it.todo("date field source: operator evaluated against date string value");
});

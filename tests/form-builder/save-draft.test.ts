import { describe, it } from "vitest";

describe("Save Draft (BUILDER-03)", () => {
  it.todo(
    "saveDraftAction creates a new template_versions row with version_number = max + 1"
  );
  it.todo(
    "re-saving creates a second row without mutating the first version row"
  );
  it.todo(
    "saveDraftAction rejects an invalid schema (unknown entity type) with an error"
  );
  it.todo(
    "saveDraftAction requires admin authentication — unauthenticated call throws"
  );
});

import { describe, it } from "vitest";

describe("Submission Version Pinning", () => {
  it.todo(
    "a submission references template_version_id pointing to the version it was filled against"
  );
  it.todo(
    "viewing an old submission renders the schema from its pinned version, not the current/latest version"
  );
  it.todo(
    "publishing a new version does not alter the schema visible on past submissions"
  );
});

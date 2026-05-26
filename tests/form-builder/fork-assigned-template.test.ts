// Wave-0 scaffold for Phase 16 D-05/D-06 — full assertions land in Plan 05
//
// D-05: forkAssignedTemplate reads the EXACT template_version_id pinned on
//       the assignment row, not the latest published version.
// D-06: after fork-version insert, form_assignments is updated to point at
//       the forked template_id and template_version_id.
//
// The production module path this scaffold reserves:
//   @/app/client/assignments/actions (forkAssignedTemplate)
//
// Phase 16 Plan 16-01 (scaffold) → Plan 05 (implementation)

import { describe, it } from "vitest";

describe("forkAssignedTemplate — Phase 16 D-05/D-06", () => {
  it.todo("reads pinned template_version_id from assignment row (not latest published)");
  it.todo("inserts new form_templates row with owner_type='customer', owner_id=ctx.client_id");
  it.todo("inserts template_versions row with schema_json copied from pinned version");
  it.todo("updates form_assignments to point template_id + template_version_id at fork");
  it.todo("returns the new forked template id");
});

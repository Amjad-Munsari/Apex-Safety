import { describe, it, expect } from "vitest";
import { validateSchema } from "@coltorapps/builder";

// coltorapps requires proper UUIDs as entity IDs — non-UUID strings are rejected
// with "The entity id '...' is invalid." before type checking even happens.
const UUID_1 = "51324b32-adc3-4d17-a90e-66b5453935bd";
const UUID_2 = "d5ae8682-156c-4511-b972-98c6c3b7c41b";

describe("validateSchema", () => {
  it("rejects an unknown entity type", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const result = await validateSchema(
      {
        entities: {
          [UUID_1]: {
            type: "unknownType",
            attributes: {},
          },
        },
        root: [UUID_1],
      },
      formBuilder
    );
    expect(result.success).toBe(false);
  });

  it("accepts a valid schema with a textField and a sectionGroup in root", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const result = await validateSchema(
      {
        entities: {
          [UUID_1]: {
            type: "textField",
            attributes: {
              label: "Name",
              required: false,
              placeholder: "",
              helpText: "",
              prefillSource: "",
            },
          },
          [UUID_2]: {
            type: "sectionGroup",
            attributes: {
              title: "Header",
              description: "",
            },
          },
        },
        root: [UUID_2, UUID_1],
      },
      formBuilder
    );
    expect(result.success).toBe(true);
  });

  it.todo("validateSchema rejects a schema with a root entry referencing a missing entity id");
  it.todo("validateSchema rejects a schema with invalid attribute values (empty label)");
});

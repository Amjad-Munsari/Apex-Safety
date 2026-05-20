import { describe, it, expect } from "vitest";
import { validateSchema } from "@coltorapps/builder";

describe("validateSchema", () => {
  it("rejects an unknown entity type", async () => {
    const { formBuilder } = await import("@/lib/form-builder/index");
    const result = await validateSchema(
      {
        entities: {
          "abc-123": {
            type: "unknownType",
            attributes: {},
          },
        },
        root: ["abc-123"],
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
          "text-1": {
            type: "textField",
            attributes: {
              label: "Name",
              required: false,
              placeholder: "",
              helpText: "",
              prefillSource: "",
            },
          },
          "section-1": {
            type: "sectionGroup",
            attributes: {
              title: "Header",
              description: "",
            },
          },
        },
        root: ["section-1", "text-1"],
      },
      formBuilder
    );
    expect(result.success).toBe(true);
  });

  it.todo("validateSchema rejects a schema with a root entry referencing a missing entity id");
  it.todo("validateSchema rejects a schema with invalid attribute values (empty label)");
});

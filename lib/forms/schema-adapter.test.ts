import { describe, it, expect } from "vitest";
import { flatToSections } from "./schema-adapter";
import type { FormSchema as BuilderSchema } from "@/lib/types/form-builder";

describe("flatToSections", () => {
  it("wraps a flat builder schema in a single 'default' section", () => {
    const flat: BuilderSchema = {
      fields: [
        { id: "f1", key: "name", type: "text", label: "Name", required: true },
        { id: "f2", key: "notes", type: "textarea", label: "Notes", required: false },
      ],
    };
    const result = flatToSections(flat, { title: "My Form" });
    expect(result.title).toBe("My Form");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].id).toBe("default");
    expect(result.sections[0].title).toBe("Section 1");
    expect(result.sections[0].fields).toHaveLength(2);
    expect(result.sections[0].fields[0].id).toBe("f1");
  });

  it("defaults the title to 'Untitled form' when not provided", () => {
    const result = flatToSections({ fields: [] });
    expect(result.title).toBe("Untitled form");
  });

  it("returns version: 1 by default for renderer compatibility", () => {
    const result = flatToSections({ fields: [] });
    expect(result.version).toBe(1);
  });

  it("preserves field options and required flag through the conversion", () => {
    const flat: BuilderSchema = {
      fields: [
        {
          id: "f1",
          key: "site",
          type: "dropdown",
          label: "Site",
          required: true,
          options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
        },
      ],
    };
    const result = flatToSections(flat);
    expect(result.sections[0].fields[0].required).toBe(true);
    expect(result.sections[0].fields[0].options).toEqual([
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ]);
  });
});

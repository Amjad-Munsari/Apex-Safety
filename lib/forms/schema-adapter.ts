import type { FormSchema as RendererSchema, FormField as RendererField } from "@/types/forms";

interface FlatToSectionsOptions {
  title?: string;
  description?: string;
  version?: number;
}

/**
 * @deprecated Phase 13 cutover: coltorapps replaced the old flat FormSchema.
 * This adapter was a shim between the old builder (flat fields[]) and the old
 * renderer (sectioned schema). Both have been replaced; this file is dead code.
 * It is preserved only to avoid breaking the schema-adapter.test.ts suite until
 * a cleanup pass removes these files in a future phase.
 */
export function flatToSections(
  flat: { fields: unknown[] },
  opts: FlatToSectionsOptions = {}
): RendererSchema {
  return {
    version: opts.version ?? 1,
    title: opts.title ?? "Untitled form",
    description: opts.description,
    sections: [
      {
        id: "default",
        title: "Section 1",
        fields: flat.fields as unknown as readonly RendererField[],
      },
    ],
  };
}

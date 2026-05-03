import type { FormSchema as BuilderSchema } from "@/lib/types/form-builder";
import type { FormSchema as RendererSchema, FormField as RendererField } from "@/types/forms";

interface FlatToSectionsOptions {
  title?: string;
  description?: string;
  version?: number;
}

/**
 * Wraps a flat builder schema (`{ fields: [...] }`) into the nested renderer
 * schema (`{ title, sections: [{ id, title, fields }] }`) so the existing
 * `form-renderer.tsx` can consume builder output unchanged.
 *
 * This is a deliberate shim — the two schemas remain separate to avoid a
 * cross-cutting refactor. See docs/plans/2026-05-03-client-form-builder.md
 * for the scoping decision.
 */
export function flatToSections(
  flat: BuilderSchema,
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

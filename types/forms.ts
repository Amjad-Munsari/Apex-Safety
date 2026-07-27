/**
 * 888 Safety & Training - Form Schema Specification
 * 
 * This file defines the structure of form templates and their versions.
 * Submissions pin to a specific TemplateVersion.
 */

export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "dropdown"
  | "multi-select"
  | "signature"
  | "rating"
  | "media"
  | "multi-photo"
  | "geolocation"
  | "repeating"
  | "heading"
  | "separator";

export interface FormFieldOption {
  readonly label: string;
  readonly value: string;
}

export interface FormField {
  readonly id: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly placeholder?: string;
  readonly helpText?: string;
  readonly required?: boolean;
  readonly options?: readonly FormFieldOption[]; // For dropdown/multi-select/checkbox-group
  readonly maxRating?: number; // For rating
  readonly maxPhotos?: number; // For multi-photo
  readonly config?: Record<string, unknown>; // Type-specific configuration (e.g. number min/max/step)
}

export interface FormSection {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly FormField[];
}

export interface FormSchema {
  readonly version: number;
  readonly title: string;
  readonly description?: string;
  readonly sections: readonly FormSection[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Database Mapping
 */
export interface FormTemplate {
  readonly id: string;
  readonly name: string;
  readonly template_type: string;
  readonly owner_id?: string;
  readonly owner_type: "admin" | "client";
  readonly is_published: boolean;
  readonly current_draft_json?: FormSchema;
  readonly created_at: string;
}

export interface TemplateVersion {
  readonly id: string;
  readonly template_id: string;
  readonly version_number: number;
  readonly schema_json: FormSchema;
  readonly published_at: string;
  readonly created_by: string;
}

/**
 * Coerce a raw schema_json blob into a canonical FormSchema.
 *
 * Some templates were published with a flat `{ fields: [...] }` shape
 * (no `sections` wrapper). Rather than crashing downstream, wrap the
 * stray fields in a single anonymous section so the renderer and the
 * progress calculator can stay simple.
 *
 * Returns an empty-but-valid schema for any other malformed input.
 */
export function normalizeFormSchema(raw: unknown): FormSchema {
  const obj = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {});

  const version = typeof obj.version === "number" ? obj.version : 1;
  const title = typeof obj.title === "string" ? obj.title : "Assessment";
  const description = typeof obj.description === "string" ? obj.description : undefined;
  const metadata = obj.metadata && typeof obj.metadata === "object"
    ? (obj.metadata as Record<string, unknown>)
    : undefined;

  if (Array.isArray(obj.sections) && obj.sections.length > 0) {
    return {
      version,
      title,
      description,
      sections: obj.sections as FormSchema["sections"],
      metadata,
    };
  }

  if (Array.isArray(obj.fields)) {
    return {
      version,
      title,
      description,
      sections: [
        {
          id: "main",
          title: "Assessment",
          fields: obj.fields as FormSection["fields"],
        },
      ],
      metadata,
    };
  }

  return { version, title, description, sections: [], metadata };
}

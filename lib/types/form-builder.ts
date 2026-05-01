export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "dropdown"
  | "multi-select"
  | "signature"
  | "rating"
  | "multi-photo"
  | "geolocation"
  | "repeating";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  maxPhotos?: number;
  maxRating?: number;
  fields?: FormField[]; // for repeating sections
}

export interface FormSchema {
  fields: FormField[];
}

export interface FormTemplate {
  id: string;
  name: string;
  template_type: string;
  is_published: boolean;
  created_at: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  schema_json: FormSchema;
  published_at: string | null;
  created_by: string | null;
}

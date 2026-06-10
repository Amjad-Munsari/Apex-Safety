"use client";

import dynamic from "next/dynamic";
import type { FormBuilderSchema } from "@/lib/form-builder";

/** Lightweight skeleton shown while the heavy builder bundle loads. */
function BuilderSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111] items-center justify-center gap-4">
      <div className="w-full max-w-2xl space-y-3 px-8">
        <div className="h-8 rounded bg-white/10 animate-pulse w-1/3" />
        <div className="h-4 rounded bg-white/10 animate-pulse w-full" />
        <div className="h-4 rounded bg-white/10 animate-pulse w-5/6" />
        <div className="h-4 rounded bg-white/10 animate-pulse w-4/6" />
      </div>
    </div>
  );
}

const TemplateBuilderClient = dynamic(
  () =>
    import("./builder-client").then((m) => ({ default: m.TemplateBuilderClient })),
  {
    ssr: false,
    loading: () => <BuilderSkeleton />,
  }
);

interface Props {
  templateId: string;
  initialName: string;
  templateType: string;
  isPublished: boolean;
  initialSchema: FormBuilderSchema | null;
  versionNumber: number;
  hasDraft: boolean;
  publishedVersionNumber: number | null;
  surface?: "dark" | "cream";
  /** Render the builder as a viewer: no save/publish/assign, name locked, palette hidden. */
  readOnly?: boolean;
  /** Short label shown in the toolbar badge when readOnly (e.g. "Client-owned template"). */
  readOnlyNotice?: string;
  /** Surface-appropriate publish confirm() copy; defaults to the admin wording. */
  publishConfirmMessage?: string;
  saveDraftAction: (templateId: string, rawSchema: unknown, templateName: string) => Promise<void>;
  publishTemplateAction: (templateId: string, rawSchema: unknown, templateName: string) => Promise<void>;
  backHref?: string;
  assignButton?: React.ReactNode;
}

export function BuilderLoader(props: Props) {
  return <TemplateBuilderClient {...props} />;
}

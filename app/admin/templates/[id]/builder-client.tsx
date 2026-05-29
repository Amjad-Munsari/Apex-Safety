"use client";

import { useState, useTransition, useEffect } from "react";
import { useBuilderStore, useBuilderStoreData } from "@coltorapps/builder-react";
import { formBuilder } from "@/lib/form-builder";
import { FieldPalette } from "@/components/form-builder/field-palette";
import { BuilderCanvas } from "@/components/form-builder/builder-canvas";
import { PropertiesPanel } from "@/components/form-builder/properties-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import type { FormBuilderSchema } from "@/lib/form-builder";
import type { CycleState } from "@/components/form-builder/conditional-logic-section";

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
  saveDraftAction: (templateId: string, rawSchema: unknown, templateName: string) => Promise<void>;
  publishTemplateAction: (templateId: string, rawSchema: unknown, templateName: string) => Promise<void>;
  backHref?: string;
  /** Optional extra button(s) rendered in the toolbar beside Save / Publish (e.g. Assign to clients). */
  assignButton?: React.ReactNode;
}

const surfaceTokens = {
  dark: {
    root: "bg-[#111]",
    toolbar: "bg-[#111] border-white/10",
    panel: "bg-[#0d0d0d]",
    columnDivider: "border-white/10",
    canvasBg: "",
    titleInput: "text-white border-transparent focus:border-white/20",
    typeLabel: "text-white/30",
    backLink: "text-white/50 hover:text-white",
    backDivider: "bg-white/10",
    saveLabel: "text-white/50 hover:text-white",
    savedTag: "text-[#3b8273]",
    errorTag: "text-[#8b2b21]",
    publishBtn: "bg-[#3b8273] hover:bg-[#3b8273]/90 text-white",
    emptyIconRing: "border-white/10",
    emptyIcon: "text-white/20",
    emptyText: "text-white/30",
    emptySubtext: "text-white/20",
    bottomBar: "bg-white/5 border-white/10 text-white/40",
    unsavedTag: "text-amber-400",
    selectPanelText: "text-white/20",
  },
  cream: {
    root: "bg-[#fbfaf5]",
    toolbar: "bg-white border-[#e5e1d8]",
    panel: "bg-[#faf9f6]",
    columnDivider: "border-[#e5e1d8]",
    canvasBg: "bg-[#fbfaf5]",
    titleInput: "text-[#1a1a1a] border-transparent focus:border-[#1a1a1a]/20",
    typeLabel: "text-[#8a857f]",
    backLink: "text-[#6b6560] hover:text-black",
    backDivider: "bg-[#e5e1d8]",
    saveLabel: "text-[#6b6560] hover:text-black",
    savedTag: "text-[#3b8273]",
    errorTag: "text-[#8b2b21]",
    publishBtn: "bg-[#1a1a1a] hover:bg-black text-white",
    emptyIconRing: "border-[#e5e1d8]",
    emptyIcon: "text-[#a8a39d]",
    emptyText: "text-[#6b6560]",
    emptySubtext: "text-[#8a857f]",
    bottomBar: "bg-[#f0ede6] border-[#e5e1d8] text-[#6b6560]",
    unsavedTag: "text-amber-600",
    selectPanelText: "text-[#8a857f]",
  },
} as const;

export function TemplateBuilderClient({
  templateId,
  initialName,
  templateType,
  isPublished,
  initialSchema,
  versionNumber,
  hasDraft,
  publishedVersionNumber,
  surface = "dark",
  saveDraftAction,
  publishTemplateAction,
  backHref,
  assignButton,
}: Props) {
  const t = surfaceTokens[surface];
  const resolvedBackHref = backHref ?? (surface === "cream" ? "/client/templates" : "/admin/templates");

  const [name, setName] = useState(initialName);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedState, setSavedState] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  // Phase 15 — cycle error state from RuleGraphInvalid server error
  const [cycleState, setCycleState] = useState<CycleState | null>(null);
  const [publishBlocked, setPublishBlocked] = useState(false);

  // Hydrate builder store from persisted schema (already coltorapps { entities, root } shape)
  const builderStore = useBuilderStore(formBuilder, {
    initialData: initialSchema ? { schema: initialSchema } : undefined,
  });

  // Phase 15 — clear cycleState when admin edits a visibilityRules attribute
  // Uses builderStore.subscribe with the EntityAttributeUpdated event (coltorapps API).
  // The listener receives (data, events[]) — filter for attributeName === "visibilityRules".
  useEffect(() => {
    const unsub = builderStore.subscribe((_data, events) => {
      for (const e of events) {
        if (
          e.name === "EntityAttributeUpdated" &&
          (e.payload as { attributeName: string }).attributeName === "visibilityRules"
        ) {
          setCycleState(null);
          setPublishBlocked(false);
          return;
        }
      }
    });
    return unsub;
  }, [builderStore]);

  // Subscribe to schema changes to track unsaved state
  const storeData = useBuilderStoreData(builderStore, () => true);
  const schema = storeData.schema;
  const entities = schema.entities as Record<
    string,
    { type: string; attributes: Record<string, unknown>; children?: string[]; parentId?: string }
  >;
  const root = schema.root as string[];

  // Count non-section fields for status bar
  const fieldCount = root.reduce((acc, id) => {
    const entity = entities[id];
    if (!entity) return acc;
    if (entity.type === "sectionGroup") {
      return acc + ((entity.children as string[] | undefined) ?? []).length;
    }
    return acc + 1;
  }, 0);

  function handleAddEntity(type: Parameters<typeof builderStore.addEntity>[0]["type"]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newEntity = builderStore.addEntity({ type, attributes: {} } as any);
    setSelectedId(newEntity.id);
    setSavedState(false);
  }

  function handleSave() {
    setSaveStatus("saving");
    startTransition(async () => {
      try {
        const rawSchema = builderStore.getSchema();
        await saveDraftAction(templateId, rawSchema, name);
        setSavedState(true);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        // Phase 15 — attempt to parse RuleGraphInvalid structured error
        try {
          const parsed = JSON.parse((err as Error).message);
          if (parsed?.kind === "RuleGraphInvalid") {
            const newCycleState: CycleState = {
              cycles: (parsed.cycles ?? []).map((c: { entityIds: string[]; labels: string[] }) => ({
                entityIds: c.entityIds,
                labels: c.labels,
              })),
              scopeErrors: parsed.scopeErrors ?? [],
            };
            setCycleState(newCycleState);
            const cycleDescriptions = newCycleState.cycles
              .map((c) => c.labels.slice(0, 3).join(" → ") + (c.labels.length > 3 ? " …" : ""))
              .join("; ");
            toast.error("Circular rule detected", {
              description: cycleDescriptions || (parsed.scopeErrors?.[0]?.reason ?? ""),
            });
            setSaveStatus("error");
            return;
          }
        } catch {
          // Not a JSON error — fall through to generic handler
        }
        setSaveStatus("error");
      }
    });
  }

  function handlePublish() {
    if (publishBlocked) return; // Guard: blocked by cycle error
    if (
      !confirm(
        `Publish v${versionNumber}? This version will become immutable and be available to assign to clients.`
      )
    )
      return;
    setSaveStatus("saving");
    startTransition(async () => {
      try {
        const rawSchema = builderStore.getSchema();
        await publishTemplateAction(templateId, rawSchema, name);
        setSavedState(true);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        // Phase 15 — attempt to parse RuleGraphInvalid structured error
        try {
          const parsed = JSON.parse((err as Error).message);
          if (parsed?.kind === "RuleGraphInvalid") {
            const newCycleState: CycleState = {
              cycles: (parsed.cycles ?? []).map((c: { entityIds: string[]; labels: string[] }) => ({
                entityIds: c.entityIds,
                labels: c.labels,
              })),
              scopeErrors: parsed.scopeErrors ?? [],
            };
            setCycleState(newCycleState);
            setPublishBlocked(true);
            const cycleDescriptions = newCycleState.cycles
              .map((c) => c.labels.slice(0, 3).join(" → ") + (c.labels.length > 3 ? " …" : ""))
              .join("; ");
            toast.error("Circular rule detected", {
              description: cycleDescriptions || (parsed.scopeErrors?.[0]?.reason ?? ""),
            });
            setSaveStatus("error");
            return;
          }
        } catch {
          // Not a JSON error — fall through to generic handler
        }
        setSaveStatus("error");
      }
    });
  }

  return (
    <div className={cn("fixed inset-0 z-50 flex flex-col", t.root)}>
      {/* Toolbar h-14 */}
      <div className={cn("h-14 flex items-center gap-4 px-6 border-b shrink-0", t.toolbar)}>
        <Link
          href={resolvedBackHref}
          className={cn(
            "flex items-center gap-2 font-mono text-xs uppercase tracking-wider transition-colors shrink-0",
            t.backLink
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Templates</span>
        </Link>

        <div className={cn("h-5 w-px shrink-0", t.backDivider)} />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSavedState(false);
            }}
            className={cn(
              "bg-transparent font-serif text-lg outline-none border-b transition-colors px-0 py-0.5 min-w-0 flex-1 max-w-md truncate",
              t.titleInput
            )}
          />
          <span className={cn("font-mono text-[10px] uppercase tracking-wider shrink-0", t.typeLabel)}>
            {templateType}
          </span>
          {hasDraft && !isPublished ? (
            <Badge className="bg-[#c0a66d]/20 text-[#c0a66d] border-[#c0a66d]/30 text-[10px] font-mono shrink-0">
              DRAFT v{versionNumber}
            </Badge>
          ) : isPublished ? (
            <Badge className="bg-[#3b8273]/20 text-[#3b8273] border-[#3b8273]/30 text-[10px] font-mono shrink-0">
              LIVE v{publishedVersionNumber}
            </Badge>
          ) : null}
          {hasDraft && isPublished && (
            <Badge className="bg-[#c0a66d]/20 text-[#c0a66d] border-[#c0a66d]/30 text-[10px] font-mono shrink-0">
              UNPUBLISHED EDITS
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {saveStatus === "saved" && (
            <span className={cn("font-mono text-[10px] uppercase tracking-wider", t.savedTag)}>
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className={cn("font-mono text-[10px] uppercase tracking-wider", t.errorTag)}>
              Save failed
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className={cn("h-8 gap-2 font-mono text-xs", t.saveLabel)}
          >
            <Save className="w-3.5 h-3.5" />
            {saveStatus === "saving" ? "Saving…" : "Save draft"}
          </Button>

          {assignButton}

          <TooltipProvider>
            <Tooltip>
              {/* base-ui renders <button> by default; passing render=<span> avoids
                  the nested-button hydration error AND keeps the tooltip hoverable
                  when the inner Button is disabled (disabled buttons swallow pointer
                  events; spans don't). */}
              <TooltipTrigger render={<span tabIndex={0} />}>
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={isPending || publishBlocked}
                  className={cn("rounded-sm h-8 gap-2 font-mono text-xs px-4", t.publishBtn)}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Publish Template
                </Button>
              </TooltipTrigger>
              {publishBlocked && (
                <TooltipContent>
                  Fix circular rules before publishing
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Builder body: three columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Field palette — w-56 */}
        <div className={cn("w-56 border-r overflow-y-auto shrink-0", t.panel, t.columnDivider)}>
          <FieldPalette onAddEntity={handleAddEntity} surface={surface} />
        </div>

        {/* Center: Canvas column */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", t.canvasBg)}>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <BuilderCanvas
              builderStore={builderStore}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
              }}
              surface={surface}
            />
          </div>

          {/* Bottom status bar h-8 */}
          <div
            className={cn(
              "h-8 px-4 border-t flex items-center gap-4 shrink-0 text-xs",
              t.bottomBar
            )}
          >
            <span className="font-mono uppercase tracking-wider">
              {fieldCount} field{fieldCount !== 1 ? "s" : ""}
            </span>
            {!savedState && (
              <span
                className={cn(
                  "font-mono uppercase tracking-wider animate-pulse",
                  t.unsavedTag
                )}
              >
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Right: Properties panel — w-72 */}
        <div className={cn("w-72 border-l overflow-y-auto shrink-0", t.panel, t.columnDivider)}>
          <PropertiesPanel
            builderStore={builderStore}
            selectedId={selectedId}
            entities={entities}
            surface={surface}
            cycleState={cycleState ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useBuilderStore, useBuilderStoreData } from "@coltorapps/builder-react";
import { formBuilder } from "@/lib/form-builder";
import { sanitizeSchemaWithReport } from "@/lib/form-builder/sanitize-schema";
import { defaultEntityAttributes } from "@/lib/form-builder/default-entity-attributes";
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

/** Human-readable summary for a scope error, used in the save/publish toast. */
function scopeErrorMessage(
  err: { reason?: string; sourceLabel?: string; consumerLabel?: string } | undefined
): string {
  if (!err) return "";
  const src = err.sourceLabel ?? "a field";
  const consumer = err.consumerLabel ?? "a field";
  switch (err.reason) {
    case "root-references-inside-repeating":
      return `"${consumer}" can't reference "${src}" inside a repeating section.`;
    case "cross-instance":
      return `"${consumer}" references "${src}" in a different instance.`;
    case "orphan-source":
      return `"${consumer}" references a deleted field.`;
    default:
      return "";
  }
}

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
  /**
   * Surface-appropriate publish confirm() copy. Defaults to the admin wording
   * ("…available to assign to clients") — client-portal pages pass their own
   * since clients don't assign templates to clients.
   */
  publishConfirmMessage?: string;
  saveDraftAction: (templateId: string, rawSchema: unknown, templateName: string) => Promise<void>;
  publishTemplateAction: (templateId: string, rawSchema: unknown, templateName: string) => Promise<void>;
  backHref?: string;
  /** Optional extra button(s) rendered in the toolbar beside Save / Publish (e.g. Assign to clients). */
  assignButton?: React.ReactNode;
}

const surfaceTokens = {
  dark: {
    root: "bg-background",
    toolbar: "bg-background border-border",
    panel: "bg-background",
    columnDivider: "border-border",
    canvasBg: "",
    titleInput: "text-foreground border-transparent focus:border-border",
    typeLabel: "text-muted-foreground",
    backLink: "text-foreground/70 hover:text-foreground",
    backDivider: "bg-muted",
    saveLabel: "text-foreground/70 hover:text-foreground",
    savedTag: "text-teal",
    errorTag: "text-danger",
    publishBtn: "bg-teal hover:bg-teal/90 text-foreground",
    emptyIconRing: "border-border",
    emptyIcon: "text-muted-foreground",
    emptyText: "text-muted-foreground",
    emptySubtext: "text-muted-foreground",
    bottomBar: "bg-muted border-border text-muted-foreground",
    unsavedTag: "text-amber-400",
    selectPanelText: "text-muted-foreground",
  },
  cream: {
    root: "bg-background",
    toolbar: "bg-card border-border",
    panel: "bg-card",
    columnDivider: "border-border",
    canvasBg: "bg-background",
    titleInput: "text-foreground border-transparent focus:border-border",
    typeLabel: "text-muted-foreground",
    backLink: "text-foreground/70 hover:text-foreground",
    backDivider: "bg-muted",
    saveLabel: "text-foreground/70 hover:text-foreground",
    savedTag: "text-teal",
    errorTag: "text-danger",
    publishBtn: "bg-primary hover:bg-primary/90 text-primary-foreground",
    emptyIconRing: "border-border",
    emptyIcon: "text-muted-foreground",
    emptyText: "text-muted-foreground",
    emptySubtext: "text-muted-foreground",
    bottomBar: "bg-muted border-border text-muted-foreground",
    unsavedTag: "text-amber-600",
    selectPanelText: "text-muted-foreground",
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
  readOnly = false,
  readOnlyNotice,
  publishConfirmMessage,
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

  // Hydrate builder store from persisted schema (already coltorapps { entities, root } shape).
  // sanitizeSchema drops entities of any since-removed type (e.g. signatureField)
  // so older templates load instead of throwing "entity type is unknown".
  // The report surfaces WHAT was dropped so we can warn the admin (audit #1)
  // instead of losing those fields silently.
  const sanitizeReport = useMemo(
    () => (initialSchema ? sanitizeSchemaWithReport(initialSchema) : null),
    [initialSchema]
  );
  const [removalDismissed, setRemovalDismissed] = useState(false);
  const removedEntities = sanitizeReport?.removedEntities ?? [];
  const builderStore = useBuilderStore(formBuilder, {
    initialData: sanitizeReport ? { schema: sanitizeReport.schema } : undefined,
  });

  // Phase 15 — clear cycleState when admin edits a visibilityRules attribute, or makes
  // any structural change that could resolve the cycle (field deleted, added, or cloned).
  // Uses builderStore.subscribe with coltorapps events (exact names from BuilderStoreEvent).
  // The listener receives (data, events[]).
  //   • EntityAttributeUpdated + attributeName === "visibilityRules" — rule edited directly
  //   • EntityDeleted — offending field removed (fires instead of "EntityRemoved")
  //   • EntityAdded / EntityCloned — new field added; rule graph changes shape
  // Clearing is safe: the next Publish attempt re-runs validateRuleGraph server-side and
  // will reject a still-cyclic schema — this only unsticks the Publish button.
  useEffect(() => {
    const unsub = builderStore.subscribe((_data, events) => {
      for (const e of events) {
        const isRuleEdit =
          e.name === "EntityAttributeUpdated" &&
          (e.payload as { attributeName: string }).attributeName === "visibilityRules";
        const isStructural =
          e.name === "EntityDeleted" ||
          e.name === "EntityAdded" ||
          e.name === "EntityCloned";
        if (isRuleEdit || isStructural) {
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
    // Seed required label/title so a freshly-added entity is immediately valid
    // (empty label/title fails save with InvalidEntitiesAttributes).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newEntity = builderStore.addEntity({ type, attributes: defaultEntityAttributes(type) } as any);
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
            const hasCycle = newCycleState.cycles.length > 0;
            toast.error(
              hasCycle ? "Circular rule detected" : "Invalid rule scope",
              {
                description:
                  cycleDescriptions ||
                  scopeErrorMessage(parsed.scopeErrors?.[0]) ||
                  "Select the affected field to see details.",
              }
            );
            setSaveStatus("error");
            return;
          }
        } catch {
          // Not a JSON error — fall through to generic handler
        }
        toast.error("Couldn't save", {
          description: (err as Error)?.message ?? "Unknown error",
        });
        setSaveStatus("error");
      }
    });
  }

  function handlePublish() {
    if (publishBlocked) return; // Guard: blocked by cycle error
    if (
      !confirm(
        publishConfirmMessage ??
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
            const hasCycle = newCycleState.cycles.length > 0;
            toast.error(
              hasCycle ? "Circular rule detected" : "Invalid rule scope",
              {
                description:
                  cycleDescriptions ||
                  scopeErrorMessage(parsed.scopeErrors?.[0]) ||
                  "Select the affected field to see details.",
              }
            );
            setSaveStatus("error");
            return;
          }
        } catch {
          // Not a JSON error — fall through to generic handler
        }
        toast.error("Couldn't publish", {
          description: (err as Error)?.message ?? "Unknown error",
        });
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
            disabled={readOnly}
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
            <Badge className="bg-gold/20 text-gold border-gold/30 text-[10px] font-mono shrink-0">
              DRAFT v{versionNumber}
            </Badge>
          ) : isPublished ? (
            <Badge className="bg-teal/20 text-teal border-teal/30 text-[10px] font-mono shrink-0">
              LIVE v{publishedVersionNumber}
            </Badge>
          ) : null}
          {hasDraft && isPublished && (
            <Badge className="bg-gold/20 text-gold border-gold/30 text-[10px] font-mono shrink-0">
              UNPUBLISHED EDITS
            </Badge>
          )}
          {readOnly && (
            <Badge className="bg-muted text-muted-foreground border-border text-[10px] font-mono shrink-0">
              READ ONLY{readOnlyNotice ? ` · ${readOnlyNotice.toUpperCase()}` : ""}
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

          {!readOnly && (
          <>
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
          </>
          )}
        </div>
      </div>

      {/* Builder body: three columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Field palette — w-56. Hidden in read-only mode: a viewer can't
            add fields, and showing the palette implies the form is editable. */}
        {!readOnly && (
          <div className={cn("w-56 border-r overflow-y-auto shrink-0", t.panel, t.columnDivider)}>
            <FieldPalette onAddEntity={handleAddEntity} surface={surface} />
          </div>
        )}

        {/* Center: Canvas column */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", t.canvasBg)}>
          {removedEntities.length > 0 && !removalDismissed && (
            <div className="shrink-0 px-6 py-3 bg-danger/10 border-b border-danger/30 flex items-start gap-3">
              <div className="flex-1 text-xs text-danger">
                <span className="font-semibold">
                  {removedEntities.length} field{removedEntities.length === 1 ? "" : "s"} removed.
                </span>{" "}
                {removedEntities.length === 1 ? "A field" : "These fields"} used a type that is no
                longer supported ({Array.from(new Set(removedEntities.map((e) => e.type))).join(", ")})
                and {removedEntities.length === 1 ? "was" : "were"} dropped from this template. Any
                saved answers for {removedEntities.length === 1 ? "it" : "them"} are lost. Saving or
                publishing will persist this removal.
              </div>
              <button
                onClick={() => setRemovalDismissed(true)}
                className="text-danger/60 hover:text-danger text-xs font-mono shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
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
            {!savedState && !readOnly && (
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

        {/* Right: Properties panel — w-[28rem] (448px). Sized so the
            ConditionalLogicSection RuleRow stacked layout (source on line 1,
            op + value on line 2, action + trash on line 3) gives the value
            input ~280px of usable width. */}
        <div className={cn("w-[28rem] border-l overflow-y-auto shrink-0", t.panel, t.columnDivider)}>
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

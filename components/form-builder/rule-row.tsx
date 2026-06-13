"use client";

/**
 * RuleRow — single conditional-logic rule row in the builder properties panel.
 *
 * Per UI-SPEC §1 rule-row layout:
 *   [Source ▼] [Operator ▼] [Value…] → [Action ▼] [🗑]
 *
 * D-03: Source-field dropdown filters candidates using isAncestorScope.
 * D-06: Operator dropdown filters by source entity type.
 * A7:   Action dropdown excludes "require" when hostEntityType === "computedField".
 *
 * No new shadcn primitives — all elements are native <select>/<input> styled
 * with the same surfaceTokens map as properties-panel.tsx.
 */

import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { isAncestorScope } from "@/lib/form-builder/visibility/scope";
import type { VisibilityRule } from "@/lib/form-builder/attributes/visibility-rules";

// ---------------------------------------------------------------------------
// Surface tokens — mirrors properties-panel.tsx surfaceTokens map
// ---------------------------------------------------------------------------

type Surface = "dark" | "cream";

const surfaceTokens = {
  dark: {
    select: "bg-muted border-border text-foreground focus:border-border",
    input: "bg-transparent border-border text-foreground placeholder:text-muted-foreground focus:border-border",
    separator: "text-muted-foreground",
    trashBtn: "text-muted-foreground hover:text-danger",
  },
  cream: {
    select: "bg-white border-[#e5e1d8] text-[#1a1a1a] focus:border-[#1a1a1a]/40",
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    separator: "text-[#8a857f]",
    trashBtn: "text-[#8a857f] hover:text-[#8b2b21]",
  },
} as const;

// ---------------------------------------------------------------------------
// Operator filter map — D-06 per UI-SPEC §"Operator Display Labels"
// ---------------------------------------------------------------------------

type OperatorEntry = { value: string; label: string };

/**
 * Returns the operator entries applicable for a given source entity type.
 * "all" operators: equals, notEquals, isEmpty, isNotEmpty.
 * "numeric" extras (number, date, computedField): greaterThan, lessThan.
 * "text" extras (textField, textareaField): contains.
 */
export function getOperatorsForSourceType(sourceType: string): OperatorEntry[] {
  const all: OperatorEntry[] = [
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "not equals" },
    { value: "isEmpty", label: "is empty" },
    { value: "isNotEmpty", label: "is not empty" },
  ];

  const textExtras: OperatorEntry[] = [
    { value: "contains", label: "contains" },
  ];

  const numericExtras: OperatorEntry[] = [
    { value: "greaterThan", label: ">" },
    { value: "lessThan", label: "<" },
  ];

  switch (sourceType) {
    case "textField":
    case "textareaField":
      return [...all, ...textExtras];
    case "numberField":
    case "dateField":
    case "computedField":
      return [...all, ...numericExtras];
    default:
      return all;
  }
}

// ---------------------------------------------------------------------------
// Schema minimal type (same minimal-shape pattern as scope.ts)
// ---------------------------------------------------------------------------

type SchemaEntity = {
  type: string;
  attributes?: Record<string, unknown>;
  children?: string[];
};

type BuilderSchema = {
  entities: Record<string, SchemaEntity>;
};

// ---------------------------------------------------------------------------
// RuleRow props
// ---------------------------------------------------------------------------

export interface RuleRowProps {
  rule: VisibilityRule;
  index: number;
  hostEntityId: string;
  hostEntityType: string;
  schema: BuilderSchema;
  surface?: Surface;
  onChange: (newRule: VisibilityRule) => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// RuleRow component
// ---------------------------------------------------------------------------

export function RuleRow({
  rule,
  index: _index,
  hostEntityId,
  hostEntityType,
  schema,
  surface = "dark",
  onChange,
  onDelete,
}: RuleRowProps) {
  const t = surfaceTokens[surface];

  // Build eligible source candidates: all entities except self, excluding containers
  const eligibleSources = Object.entries(schema.entities).filter(([candidateId, candidate]) => {
    if (candidateId === hostEntityId) return false;
    // Exclude container types (repeatingSection, sectionGroup) as direct sources
    if (candidate.type === "repeatingSection" || candidate.type === "sectionGroup") return false;
    // D-03 scope filter: same scope OR ancestor scope
    return isAncestorScope(schema, hostEntityId, candidateId);
  });

  const sourceEntity = rule.sourceEntityId ? schema.entities[rule.sourceEntityId] : undefined;
  const sourceType = sourceEntity?.type ?? "";
  const operators = getOperatorsForSourceType(sourceType);

  // Check if current operator is still valid after source-type change
  const currentOperatorValid = operators.some((op) => op.value === rule.operator);

  // A7: filter "require" from action dropdown when host is computedField.
  // Containers (sectionGroup/repeatingSection) can be shown/hidden but never
  // "required", so drop require for them too.
  const hostIsContainer =
    hostEntityType === "sectionGroup" || hostEntityType === "repeatingSection";
  const actions: OperatorEntry[] = [
    { value: "show", label: "show" },
    { value: "hide", label: "hide" },
    ...(hostEntityType !== "computedField" && !hostIsContainer
      ? [{ value: "require", label: "require" }]
      : []),
  ];

  function handleSourceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSourceId = e.target.value;
    const newSourceType = newSourceId ? (schema.entities[newSourceId]?.type ?? "") : "";
    const newOperators = getOperatorsForSourceType(newSourceType);
    const operatorStillValid = newOperators.some((op) => op.value === rule.operator);
    onChange({
      ...rule,
      sourceEntityId: newSourceId,
      // Reset operator to placeholder if it's no longer valid for the new source type
      operator: operatorStillValid ? rule.operator : ("" as VisibilityRule["operator"]),
    });
  }

  function handleOperatorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange({
      ...rule,
      operator: e.target.value as VisibilityRule["operator"],
    });
  }

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ ...rule, value: e.target.value });
  }

  function handleValueSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange({ ...rule, value: e.target.value });
  }

  // When the source is a select field, offer its options as a dropdown so the
  // rule value matches the option's stored VALUE (not a hand-typed label that
  // would silently never match). null for non-select sources → free-text input.
  //
  // Multi-select (allowMultiple) sources are usable here too: the stored answer
  // is an array of option values, and evaluate-rule's `equals`/`notEquals`
  // treat an array source as membership (does the picked option appear in the
  // selection?). The value picker still offers ONE option at a time, so a rule
  // expresses "selection includes <option>" — picking a single value is the
  // intended granularity; AND-ing multiple rows covers "includes A and B".
  const sourceOptions =
    sourceType === "selectField"
      ? ((sourceEntity?.attributes?.options as
          | Array<{ value: string; label: string }>
          | undefined) ?? [])
      : null;

  function handleActionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange({ ...rule, action: e.target.value as VisibilityRule["action"] });
  }

  const isNullaryOperator =
    rule.operator === "isEmpty" || rule.operator === "isNotEmpty";

  return (
    <div className="flex flex-col gap-1.5 py-2">
      {/* Line 1 — Source-field dropdown (full row width) */}
      <select
        value={rule.sourceEntityId}
        onChange={handleSourceChange}
        className={cn(
          "w-full border rounded-[3px] px-2 py-1 text-xs outline-none transition-colors",
          t.select
        )}
      >
        <option value="">— field —</option>
        {eligibleSources.length === 0 && (
          <option value="" disabled>
            — no eligible fields —
          </option>
        )}
        {eligibleSources.map(([id, e]) => (
          <option key={id} value={id}>
            {(e.attributes?.label as string) ?? id}
          </option>
        ))}
        {/* Keep a still-referenced source visible even when it became
            out-of-scope (e.g. moved into a repeating section) or was deleted —
            otherwise the control blanks out and the rule looks empty while the
            schema still holds the (now invalid) reference. */}
        {rule.sourceEntityId &&
          !eligibleSources.some(([id]) => id === rule.sourceEntityId) && (
            <option value={rule.sourceEntityId}>
              {sourceEntity
                ? `${(sourceEntity.attributes?.label as string) ?? rule.sourceEntityId} (out of scope)`
                : `${rule.sourceEntityId} (deleted)`}
            </option>
          )}
      </select>

      {/* Line 2 — Operator dropdown + Value input */}
      <div className="flex gap-1.5 items-center">
        <select
          value={currentOperatorValid ? rule.operator : ""}
          onChange={handleOperatorChange}
          className={cn(
            "w-28 border rounded-[3px] px-2 py-1 text-xs outline-none transition-colors shrink-0",
            t.select
          )}
        >
          <option value="">— operator —</option>
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        {/* Value slot — a dropdown of the source select's options when the
            source is a select, free text otherwise. Hidden (zero-width) when
            operator is isEmpty / isNotEmpty (no reflow). */}
        {sourceOptions && !isNullaryOperator ? (
          <select
            value={(rule.value as string) ?? ""}
            onChange={handleValueSelectChange}
            className={cn(
              "flex-1 min-w-0 border rounded-[3px] px-2 py-1 text-xs outline-none transition-colors",
              t.select
            )}
          >
            <option value="">— value —</option>
            {sourceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={isNullaryOperator ? "" : ((rule.value as string) ?? "")}
            onChange={handleValueChange}
            placeholder="value…"
            readOnly={isNullaryOperator}
            className={cn(
              "border rounded-[3px] px-2 py-1 text-xs outline-none transition-colors",
              isNullaryOperator
                ? "w-0 overflow-hidden p-0 border-0"
                : cn("flex-1 min-w-0", t.input)
            )}
          />
        )}
      </div>

      {/* Line 3 — Arrow + Action dropdown + Delete button */}
      <div className="flex gap-1.5 items-center">
        <span className={cn("text-xs px-0.5 select-none shrink-0", t.separator)}>→</span>

        <select
          value={rule.action}
          onChange={handleActionChange}
          className={cn(
            "w-28 border rounded-[3px] px-2 py-1 text-xs outline-none transition-colors shrink-0",
            t.select
          )}
        >
          <option value="">— action —</option>
          {actions.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <span className="flex-1" />

        <button
          onClick={onDelete}
          type="button"
          className={cn(
            "w-6 h-6 flex items-center justify-center transition-colors flex-shrink-0",
            t.trashBtn
          )}
          aria-label="Remove rule"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

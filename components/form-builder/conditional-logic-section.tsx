"use client";

/**
 * ConditionalLogicSection — collapsible rule editor in the properties panel.
 *
 * Per UI-SPEC §1:
 * - Collapsed by default; header shows: [GitFork] CONDITIONAL LOGIC [(N)] [chevron]
 * - Expanded: AND/OR segmented toggle + rule rows + dashed "+ Add condition" button
 *
 * Writes via: onChange({ rules, logic }) — caller wires to setAttr("visibilityRules", ...)
 *
 * No new shadcn primitives — same surface tokens as properties-panel.tsx.
 */

import { useState } from "react";
import { GitFork, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuleRow } from "./rule-row";
import { CycleErrorBanner } from "./cycle-error-banner";
import type { VisibilityRules, VisibilityRule } from "@/lib/form-builder/attributes/visibility-rules";

// ---------------------------------------------------------------------------
// Surface tokens — mirrors properties-panel.tsx surfaceTokens map
// ---------------------------------------------------------------------------

type Surface = "dark" | "cream";

const surfaceTokens = {
  dark: {
    label: "text-muted-foreground",
    headerBorder: "border-border",
    toggleActiveChip: "bg-teal text-foreground",
    toggleInactiveChip: "bg-muted text-muted-foreground",
    addBtn: "border-dashed border-border text-muted-foreground hover:text-teal",
  },
  cream: {
    label: "text-[#8a857f]",
    headerBorder: "border-[#e5e1d8]",
    toggleActiveChip: "bg-[#1a1a1a] text-white",
    toggleInactiveChip: "bg-[#e5e1d8] text-[#8a857f]",
    addBtn: "border-dashed border-[#e5e1d8] text-[#8a857f] hover:text-[#1a1a1a]",
  },
} as const;

// ---------------------------------------------------------------------------
// Default new-rule shape (exported for tests and for add-condition logic)
// ---------------------------------------------------------------------------

export const DEFAULT_NEW_RULE: VisibilityRule = {
  sourceEntityId: "",
  operator: "equals",
  value: null,
  action: "show",
};

// ---------------------------------------------------------------------------
// Schema minimal type (matches rule-row.tsx)
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
// BuilderEntity minimal type
// ---------------------------------------------------------------------------

type BuilderEntity = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// CycleState type (parsed from RuleGraphInvalid server error)
// ---------------------------------------------------------------------------

export interface CycleState {
  cycles: Array<{ entityIds: string[]; labels: string[] }>;
  scopeErrors: Array<{
    consumerId: string;
    sourceId: string;
    consumerLabel?: string;
    sourceLabel?: string;
    reason: "cross-instance" | "root-references-inside-repeating" | "orphan-source";
    severity?: "advisory";
  }>;
}

// ---------------------------------------------------------------------------
// ConditionalLogicSection props
// ---------------------------------------------------------------------------

export interface ConditionalLogicSectionProps {
  entity: BuilderEntity;
  schema: BuilderSchema;
  surface?: Surface;
  onChange: (next: VisibilityRules) => void;
  /** Optional cycle/scope error state piped from the save/publish error handler */
  cycleState?: CycleState;
  /** @internal test-only: force expanded state on initial render */
  defaultExpanded?: boolean;
}

// ---------------------------------------------------------------------------
// ConditionalLogicSection component
// ---------------------------------------------------------------------------

export function ConditionalLogicSection({
  entity,
  schema,
  surface = "dark",
  onChange,
  cycleState,
  defaultExpanded = false,
}: ConditionalLogicSectionProps) {
  const t = surfaceTokens[surface];
  const [expanded, setExpanded] = useState(defaultExpanded);

  const visibilityRules = (entity.attributes.visibilityRules as VisibilityRules | undefined) ?? {
    rules: [],
    logic: "and" as const,
  };
  const { rules, logic } = visibilityRules;
  const ruleCount = rules.length;

  function handleAddRule() {
    onChange({ rules: [...rules, { ...DEFAULT_NEW_RULE }], logic });
  }

  function handleDeleteRule(index: number) {
    const next = rules.filter((_, i) => i !== index);
    onChange({ rules: next, logic });
  }

  function handleChangeRule(index: number, newRule: VisibilityRule) {
    const next = rules.map((r, i) => (i === index ? newRule : r));
    onChange({ rules: next, logic });
  }

  function handleLogicToggle(newLogic: "and" | "or") {
    onChange({ rules, logic: newLogic });
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 w-full py-2 px-0 text-left",
          t.label
        )}
      >
        <GitFork className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-widest flex-1">
          {ruleCount > 0
            ? `CONDITIONAL LOGIC (${ruleCount})`
            : "CONDITIONAL LOGIC"}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="flex flex-col gap-2 pt-1">
          {/* AND/OR segmented toggle */}
          <div className="w-full grid grid-cols-2 h-7 rounded-[3px] overflow-hidden">
            <button
              type="button"
              onClick={() => handleLogicToggle("and")}
              className={cn(
                "flex items-center justify-center text-xs font-mono uppercase transition-colors",
                logic === "and" ? t.toggleActiveChip : t.toggleInactiveChip
              )}
            >
              AND
            </button>
            <button
              type="button"
              onClick={() => handleLogicToggle("or")}
              className={cn(
                "flex items-center justify-center text-xs font-mono uppercase transition-colors",
                logic === "or" ? t.toggleActiveChip : t.toggleInactiveChip
              )}
            >
              OR
            </button>
          </div>

          {/* Rule rows */}
          {rules.map((rule, index) => (
            <RuleRow
              key={index}
              rule={rule}
              index={index}
              hostEntityId={entity.id}
              hostEntityType={entity.type}
              schema={schema}
              surface={surface}
              onChange={(newRule) => handleChangeRule(index, newRule)}
              onDelete={() => handleDeleteRule(index)}
            />
          ))}

          {/* CycleErrorBanner — renders above Add condition button when cycleState present */}
          {cycleState && (
            <CycleErrorBanner
              cycles={cycleState.cycles}
              scopeErrors={cycleState.scopeErrors}
              selectedEntityId={entity.id}
              surface={surface}
            />
          )}

          {/* Add condition button */}
          <button
            type="button"
            onClick={handleAddRule}
            className={cn(
              "h-7 w-full border rounded-[3px] text-xs font-mono transition-colors",
              t.addBtn
            )}
          >
            + Add condition
          </button>
        </div>
      )}
    </div>
  );
}

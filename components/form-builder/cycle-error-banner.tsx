"use client";

/**
 * CycleErrorBanner — inline warning block for cycle and scope errors
 * in the builder PropertiesPanel ConditionalLogicSection.
 *
 * Per UI-SPEC §2:
 * - Container: `rounded-[3px] border border-[#8b2b21]/40 bg-[#8b2b21]/10 px-3 py-2`
 * - Icon: AlertTriangle (12px)
 * - Text: text-[10px] with text-destructive
 *
 * Renders nothing when the selectedEntityId is not part of any reported cycle or scope error.
 * Renders one banner per matching cycle and one per matching scope error.
 */

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Surface = "dark" | "cream";

interface CycleEntry {
  /** Entity IDs forming the cycle */
  entityIds: string[];
  /** Human-readable labels for the same positions */
  labels: string[];
}

interface ScopeErrorEntry {
  consumerId: string;
  sourceId: string;
  consumerLabel?: string;
  sourceLabel?: string;
  reason:
    | "cross-instance"
    | "root-references-inside-repeating"
    | "orphan-source";
  severity?: "advisory";
}

export interface CycleErrorBannerProps {
  cycles?: CycleEntry[];
  scopeErrors?: ScopeErrorEntry[];
  selectedEntityId: string;
  surface: Surface;
}

// ── Label truncation ──────────────────────────────────────────────────────────

/**
 * Join labels with " → ", truncating at 3 hops + "…" per UI-SPEC §2.
 *
 * The labels array from validate-rule-graph includes the start node repeated
 * at the end to close the loop (e.g. ["A","B","C","A"]). We display only the
 * unique segment (first label through the last unique label before the repeat).
 * If there are more than 3 unique hops we truncate at 3 + "…".
 */
function formatCycleLabels(labels: string[]): string {
  if (!labels || labels.length === 0) return "";

  // Remove the trailing repeated label (cycle closure)
  const unique =
    labels.length > 1 && labels[0] === labels[labels.length - 1]
      ? labels.slice(0, -1)
      : labels;

  if (unique.length <= 3) {
    return unique.join(" → ");
  }

  return unique.slice(0, 3).join(" → ") + " …";
}

// ── Banner sub-component ──────────────────────────────────────────────────────

function ErrorBanner({
  line1,
  line2,
}: {
  line1: string;
  line2: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[3px] border border-[#8b2b21]/40 bg-[#8b2b21]/10 px-3 py-2 flex flex-col gap-0.5"
      )}
    >
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px text-destructive" />
        <span className="text-[10px] text-destructive leading-snug">{line1}</span>
      </div>
      <span className="text-[10px] text-destructive/70 leading-snug pl-[18px]">
        {line2}
      </span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CycleErrorBanner({
  cycles = [],
  scopeErrors = [],
  selectedEntityId,
  surface: _surface,
}: CycleErrorBannerProps) {
  // Find cycles that include the selected entity
  const matchingCycles = cycles.filter((c) =>
    c.entityIds.includes(selectedEntityId)
  );

  // Find scope errors where the selected entity is the consumer
  const matchingScopeErrors = scopeErrors.filter(
    (e) => e.consumerId === selectedEntityId
  );

  if (matchingCycles.length === 0 && matchingScopeErrors.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Cycle banners */}
      {matchingCycles.map((cycle, i) => (
        <ErrorBanner
          key={`cycle-${i}`}
          line1={`Circular rule: ${formatCycleLabels(cycle.labels)}`}
          line2="Remove a rule above to break the cycle."
        />
      ))}

      {/* Scope error banners */}
      {matchingScopeErrors.map((err, i) => {
        let line1: string;
        let line2: string;

        if (err.reason === "cross-instance") {
          line1 = `Cross-instance rule rejected: ${err.sourceLabel ?? err.sourceId} is in a different instance`;
          line2 = "Pick a sibling in this instance or an ancestor field.";
        } else if (err.reason === "root-references-inside-repeating") {
          line1 = `Cannot reference inside a repeating section from root: ${err.sourceLabel ?? err.sourceId}`;
          line2 = "Pick a root field or move this rule into the repeating section.";
        } else {
          // orphan-source (advisory)
          line1 = `Source field deleted: ${err.sourceLabel ?? err.sourceId}`;
          line2 = "Remove this rule or pick a new source.";
        }

        return <ErrorBanner key={`scope-${i}`} line1={line1} line2={line2} />;
      })}
    </div>
  );
}

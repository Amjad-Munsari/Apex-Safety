/**
 * lib/form-builder/visibility/types.ts
 *
 * Shared type definitions for the conditional logic visibility bundle.
 * Re-exports key types used across evaluate-rule, combine-rules, cascade-visibility,
 * evaluate-visibility, and strip-hidden-answers.
 *
 * Phase 15 Plan 15-02
 */

/**
 * Result of evaluating visibility/required state for a single entity.
 * Produced by evaluateVisibility() and consumed by:
 * - renderer wrappers (dynamicRequired threading)
 * - computeFormProgress (drop hidden from denominator)
 * - stripHiddenAnswers (server-side scrub)
 */
export type VisibilityState = {
  visible: boolean;
  /**
   * Dynamic — folds static requiredAttribute AND fired `require` rules.
   * D-07: when visible === false, required is always false (hidden trumps required).
   */
  required: boolean;
};

/**
 * Minimal structural shape for a form schema — FormBuilderSchema satisfies this.
 * Copied verbatim from lib/form-builder/progress.ts lines 23-33 per 15-PATTERNS guidance.
 * Using the minimal shape (not FormBuilderSchema) keeps the module trivially testable
 * with hand-built schemas.
 */
export type ProgressSchema = {
  entities: Record<
    string,
    {
      type?: string;
      attributes?: Record<string, unknown>;
      children?: string[];
    }
  >;
};

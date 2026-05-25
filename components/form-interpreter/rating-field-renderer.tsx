"use client"

/**
 * RatingFieldRenderer
 *
 * Wraps an inline star-rating row inside the coltorapps EntityComponentProps
 * shell. Implemented inline (not wrapping components/forms/rating-field.tsx)
 * because the existing component's surface tokens and attrs contract differ
 * from the Phase 14 EntityComponentProps pattern — ~40 lines inline is cleaner.
 *
 * WCAG 2.5.5 (44px minimum touch target):
 *   Each star button is wrapped in a min-w-[44px] min-h-[44px] flex container
 *   per UI-SPEC §ratingFieldRenderer. The star icon itself is h-7 w-7 (28px)
 *   with p-1 padding; the wrapper provides the full 44px touch target.
 *
 * Deselect on same-click:
 *   Clicking the currently-selected star calls setValue(0) to deselect.
 *   Clicking any other star sets that rating.
 *
 * AttachPhotosAffordance cross-plan dependency (D-05):
 *   Plan 14-06 shipped the <AttachPhotosAffordance> component. The import and
 *   JSX invocation are now active — rendered conditionally on attrs.attachPhotos.
 *
 * @see D-05 (attachPhotos affordance)
 * @see UI-SPEC §ratingFieldRenderer
 */

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { ratingFieldEntity } from "@/lib/form-builder/entities/rating-field"

import { AttachPhotosAffordance } from "./attach-photos-affordance"

type Props = EntityComponentProps<typeof ratingFieldEntity> & {
  surface?: "dark" | "cream"
  /** Optional — only required when attrs.attachPhotos is true */
  clientId?: string
  /** Optional — only required when attrs.attachPhotos is true */
  submissionId?: string
  /** Phase 15: dynamic required from a fired `require` visibility rule. */
  dynamicRequired?: boolean
}

const surfaceTokens = {
  dark: {
    label: "text-white/70",
    required: "text-[#8b2b21]",
    helpText: "text-white/40",
    error: "text-[#8b2b21]",
    starFilled: "text-[#d97706]",
    starIdle: "text-slate-700 hover:text-amber-500/60",
    scoreActive: "text-slate-300",
    scoreMuted: "text-slate-500",
  },
  cream: {
    label: "text-[#1a1a1a]",
    required: "text-[#8b2b21]",
    helpText: "text-[#6b6560]",
    error: "text-[#8b2b21]",
    starFilled: "text-[#d97706]",
    starIdle: "text-[#d8d4cc] hover:text-amber-500/60",
    scoreActive: "text-[#1a1a1a]",
    scoreMuted: "text-[#8a857f]",
  },
} as const

export function RatingFieldRenderer({ entity, setValue, surface = "cream", clientId, submissionId, dynamicRequired = false }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes
  const error = entity.error ? String(entity.error) : undefined

  const maxRating = (attrs.maxRating as number) ?? 5
  const current = (entity.value as number | undefined) ?? 0

  const handleStarClick = (n: number) => {
    setValue(n === current ? 0 : n)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn("text-sm font-semibold", t.label)}>
        {attrs.label}
        {(attrs.required || dynamicRequired) && (
          <span className={cn("ml-1", t.required)}>*</span>
        )}
      </label>

      {/* Star row with WCAG 2.5.5 44px touch-target wrappers (UI-SPEC §ratingFieldRenderer) */}
      <div
        role="group"
        aria-label={attrs.label as string}
        className="flex items-center gap-1"
      >
        {Array.from({ length: maxRating }, (_, i) => i + 1).map((n) => {
          const filled = n <= current
          return (
            /* WCAG 2.5.5: min-w-[44px] min-h-[44px] wrapper ensures the clickable
               area meets the 44px minimum even though the star icon is 28px (h-7 w-7). */
            <div
              key={n}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <button
                type="button"
                aria-label={`Rate ${n} of ${maxRating}`}
                onClick={() => handleStarClick(n)}
                className={cn(
                  "p-1 transition-colors rounded-sm",
                  filled ? t.starFilled : t.starIdle
                )}
              >
                <Star
                  className="h-7 w-7"
                  fill={filled ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              </button>
            </div>
          )
        })}

        {/* Score display: "{current} / {maxRating}" in JetBrains-Mono tabular-nums */}
        <span
          className={cn(
            "font-mono text-sm tabular-nums ml-3",
            current > 0 ? t.scoreActive : t.scoreMuted
          )}
        >
          {current} / {maxRating}
        </span>
      </div>

      {attrs.helpText && (
        <p className={cn("text-xs", t.helpText)}>{attrs.helpText as string}</p>
      )}
      {error && (
        <p className={cn("text-xs", t.error)}>{error}</p>
      )}

      {attrs.attachPhotos && clientId && submissionId && (
        <AttachPhotosAffordance
          submissionId={submissionId}
          entityId={entity.id}
          fieldLabel={attrs.label as string}
          surface={surface}
          clientId={clientId}
        />
      )}
    </div>
  )
}

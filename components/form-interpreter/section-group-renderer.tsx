"use client"

import { cn } from "@/lib/utils"
import type { EntityComponentProps } from "@coltorapps/builder-react"
import type { sectionGroupEntity } from "@/lib/form-builder/entities/section-group"

type Props = EntityComponentProps<typeof sectionGroupEntity> & {
  surface?: "dark" | "cream"
}

const surfaceTokens = {
  dark: {
    title: "text-white",
    divider: "border-white/10",
  },
  cream: {
    title: "text-foreground",
    divider: "border-border",
  },
} as const

/**
 * Renders a section container with a Newsreader 18px heading, a horizontal divider,
 * and the section's child field entities (pre-rendered by InterpreterEntities and
 * passed as JSX via the `children` prop).
 *
 * The `children` prop is provided by InterpreterEntities — it contains the already-
 * rendered children entities scoped to this sectionGroup's entity ID.
 */
export function SectionGroupRenderer({ entity, children, surface = "cream" }: Props) {
  const t = surfaceTokens[surface]
  const attrs = entity.attributes

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className={cn("font-serif text-lg font-normal leading-[1.3]", t.title)}>
          {attrs.title}
        </h2>
        <hr className={cn("mt-2 border-t", t.divider)} />
      </div>
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </section>
  )
}

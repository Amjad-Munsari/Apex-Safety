import { AlertTriangle } from "lucide-react"

export function ClientDataLoadError({ itemName }: { itemName: string }) {
  return (
    <div
      role="alert"
      className="bg-card border border-destructive/30 rounded-sm px-10 py-14 text-center"
    >
      <AlertTriangle className="mx-auto mb-4 size-6 text-destructive" aria-hidden="true" />
      <p className="font-serif text-[20px] text-foreground mb-3">
        We couldn&apos;t load your {itemName}.
      </p>
      <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
        Refresh this page once. If the message remains, contact Matt rather than
        assuming there are no records.
      </p>
    </div>
  )
}

// Renders inside the persistent admin layout (header + sidebar stay painted)
// while a [id] assessment route resolves — eliminates the navigation flash where
// the page paints before its chrome settles. Covers the fill page, /review, and
// /view segments.
export default function AssessmentDetailLoading() {
  return (
    <div className="flex flex-col gap-6 pt-8 max-w-3xl mx-auto w-full animate-pulse">
      <div className="h-4 w-40 bg-muted rounded" />
      <div className="h-8 w-2/3 bg-muted rounded" />
      <div className="h-5 w-32 bg-muted rounded" />
      <div className="mt-4 flex flex-col gap-4">
        <div className="h-24 w-full bg-muted rounded-sm" />
        <div className="h-24 w-full bg-muted rounded-sm" />
        <div className="h-24 w-full bg-muted rounded-sm" />
      </div>
    </div>
  )
}

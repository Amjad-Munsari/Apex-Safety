// The form-filling page reuses the proposal wizard's CSS variables
// (--p-bg, --p-surface, --p-gold, --p-text, …). Importing here scopes the
// global stylesheet to this route segment.
import "../../proposals/proposals.css";

export default function AssessmentDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

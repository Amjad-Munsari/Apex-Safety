// The assessment wizard reuses the proposal wizard's design tokens and
// `prop-*` class system. Importing the CSS here scopes its global registration
// to this route segment.
import "../../proposals/proposals.css";

export default function NewAssessmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

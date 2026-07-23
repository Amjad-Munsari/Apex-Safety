import { dispatchNotification } from "@/lib/notifications/dispatch";
import { getSiteUrl } from "@/lib/site-url";

export async function sendAssignmentReminder(args: {
  cadence: "7d" | "1d" | "overdue";
  client_email: string;
  client_name: string;
  template_name: string;
  due_date: string;
  assignmentId: string;
  instructions: string | null;
}) {
  const base = getSiteUrl();

  return dispatchNotification({
    type: "assignment_reminder",
    cadence: args.cadence,
    client_email: args.client_email,
    client_name: args.client_name,
    template_name: args.template_name,
    due_date: args.due_date,
    assignment_url: `${base}/client/assignments/${args.assignmentId}`,
    instructions: args.instructions,
  });
}

import { dispatchNotification } from "@/lib/notifications/n8n-dispatch";

export async function sendAssignmentReminder(args: {
  cadence: "7d" | "1d" | "overdue";
  client_email: string;
  client_name: string;
  template_name: string;
  due_date: string;
  assignmentId: string;
  instructions: string | null;
}) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

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

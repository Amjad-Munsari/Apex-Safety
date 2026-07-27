import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AssignmentCard } from "./_components/assignment-card";
import { failedClientLoad } from "@/lib/observability/failed-client-load";

export const dynamic = "force-dynamic";

export default async function ClientAssignmentsPage() {
  const supabase = await createClient();
  const ctx = await getClientContext();

  const { data: rows, error } = ctx
    ? await supabase
        .from("form_assignments")
        .select(
          "id, template_id, due_date, status, instructions, created_at, template:form_templates(name)"
        )
        .eq("client_id", ctx.client_id)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
    : { data: null, error: null };

  const active = (rows ?? []).filter((r) => r.status !== "completed");
  const completed = (rows ?? []).filter((r) => r.status === "completed");

  return (
    <div className="space-y-12">
      {/* Page header */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            04 · Assessments
          </span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h2 className="font-serif text-[28px] text-foreground font-medium tracking-tight leading-[1.1]">
            Assessments assigned to you.
          </h2>
        </div>
      </section>

      {/* Tabs */}
      {error ? (
        failedClientLoad({
          area: "client.assignments.load",
          itemName: "assigned assessments",
          error,
          clientId: ctx?.client_id,
        })
      ) : (
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="border-b border-border w-full justify-start rounded-none bg-transparent gap-6 px-0 h-auto py-0">
          <TabsTrigger
            value="active"
            className="font-mono text-[10px] uppercase tracking-[0.2em] gap-2 px-1 pb-3 pt-0 data-active:text-foreground text-muted-foreground"
          >
            Active
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            className="font-mono text-[10px] uppercase tracking-[0.2em] gap-2 px-1 pb-3 pt-0 data-active:text-foreground text-muted-foreground"
          >
            Completed
          </TabsTrigger>
        </TabsList>

        {/* Active tab */}
        <TabsContent value="active" className="pt-6">
          {active.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <h3 className="font-serif text-[20px] text-foreground">No assessments assigned yet</h3>
              <p className="text-sm font-sans text-muted-foreground">
                When Matt assigns an assessment to your organisation, it&apos;ll appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {active.map((a) => (
                <Link key={a.id} href={`/client/assignments/${a.id}`} className="block">
                  <AssignmentCard assignment={a} variant="active" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed tab */}
        <TabsContent value="completed" className="pt-6">
          {completed.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <h3 className="font-serif text-[20px] text-foreground">No completed assessments yet</h3>
              <p className="text-sm font-sans text-muted-foreground">
                Submitted assessments will appear here for reference.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {completed.map((a) => (
                <Link key={a.id} href={`/client/assignments/${a.id}/submission`} className="block">
                  <AssignmentCard assignment={a} variant="completed" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}

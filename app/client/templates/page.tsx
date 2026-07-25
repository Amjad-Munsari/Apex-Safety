import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { NewClientTemplateButton } from "./_components/new-client-template-button";
import { ClientTemplateCard } from "./_components/client-template-card";
import { ClientDataLoadError } from "@/components/client/data-load-error";

export const dynamic = "force-dynamic";

export default async function ClientTemplatesPage() {
  const supabase = await createClient();
  // ctx may be null in demo mode if client_users is empty — skip the My
  // Templates query in that case. Real-prod unauthenticated traffic is already
  // redirected to /login by proxy.ts.
  const ctx = await getClientContext();

  const { data: mine, error } = ctx
    ? await supabase
        .from("form_templates")
        .select(`
          id, name, template_type, is_published, created_at, parent_template_id,
          template_versions(version_number, published_at)
        `)
        .eq("owner_type", "customer")
        .eq("owner_id", ctx.client_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: null, error: null };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            05 · My Templates
          </span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h2 className="font-serif text-[28px] text-foreground font-medium tracking-tight leading-[1.05]">
            My Templates
          </h2>
          <NewClientTemplateButton />
        </div>
      </section>

      {/* My Templates */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-foreground">
            My Templates
          </h3>
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
            {mine?.length ?? 0} created
          </span>
        </div>
        {error ? (
          <ClientDataLoadError itemName="templates" />
        ) : !mine || mine.length === 0 ? (
          <div className="py-6">
            <h3 className="font-serif text-xl">No templates yet</h3>
            <p className="text-sm text-muted-foreground mt-2">Create your own forms or customise an assigned assessment when it arrives.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mine.map((t) => {
              const versions = (t.template_versions ?? []) as Array<{ version_number: number; published_at: string | null }>;
              const latest = versions.sort((a, b) => b.version_number - a.version_number)[0];
              return (
                <ClientTemplateCard
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  templateType={t.template_type}
                  isPublished={t.is_published}
                  isForked={!!t.parent_template_id}
                  createdAt={t.created_at}
                  versionNumber={latest?.version_number ?? 1}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

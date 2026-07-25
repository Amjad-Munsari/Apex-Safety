import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { NewTemplateButton } from "./_components/new-template-button";
import { TemplateCard } from "./_components/template-card";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  // Demo bypass is dev-only — never skip the auth gate in production.
  const isDemoMode =
    process.env.NODE_ENV !== "production" && cookieStore.get("demo_mode")?.value === "1";
  if (!isDemoMode) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  const { data: templates } = await supabase
    .from("form_templates")
    .select(`
      id, name, template_type, is_published, created_at, owner_type, owner_id,
      template_versions(version_number, published_at)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Split by ownership: owner_type='customer' rows are built/forked by clients
  // and belong to their org; everything else is one of Matt's master templates
  // (owner_type='admin', the column default). See AGENTS.md ownership contract.
  const all = templates ?? [];
  const adminTemplates = all.filter((t) => t.owner_type !== "customer");
  const clientTemplates = all.filter((t) => t.owner_type === "customer");

  // Resolve owning-org names for the client templates so each card shows whose
  // it is. Best-effort + RLS-scoped: if it returns nothing the label simply
  // doesn't render — never blocks the page.
  const ownerNameById = new Map<string, string>();
  const ownerIds = [...new Set(clientTemplates.map((t) => t.owner_id).filter(Boolean))];
  if (ownerIds.length > 0) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", ownerIds as string[]);
    for (const c of clients ?? []) ownerNameById.set(c.id, c.name);
  }

  const renderCard = (
    t: (typeof all)[number],
    ownerLabel?: string,
  ) => {
    const versions = (t.template_versions ?? []) as Array<{ version_number: number; published_at: string | null }>;
    const latestVersion = [...versions].sort((a, b) => b.version_number - a.version_number)[0];
    const publishedCount = versions.filter((v) => v.published_at).length;
    const hasDraft = !!latestVersion && !latestVersion.published_at;

    return (
      <TemplateCard
        key={t.id}
        id={t.id}
        name={t.name}
        templateType={t.template_type}
        isPublished={t.is_published}
        createdAt={t.created_at}
        versionNumber={latestVersion?.version_number ?? 1}
        publishedCount={publishedCount}
        hasUnpublishedDraft={hasDraft}
        ownerLabel={ownerLabel}
      />
    );
  };

  return (
    <div className="flex flex-col gap-10 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-teal font-semibold">07</span>
            FORM TEMPLATES
          </div>
          <h2 className="font-serif text-[32px] leading-tight text-foreground">
            Assessment Templates
          </h2>
        </div>
        <NewTemplateButton />
      </div>

      {/* Admin (master) templates */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Admin templates</h3>
          <span className="font-mono text-[10px] text-muted-foreground">{adminTemplates.length}</span>
        </div>
        <p className="text-muted-foreground text-xs -mt-2">Your master templates — clients can fill and fork these.</p>
        {adminTemplates.length === 0 ? (
          <Card className="bg-card border-border rounded-sm p-12 text-center">
            <p className="text-muted-foreground font-mono text-sm mb-4">No admin templates yet</p>
            <p className="text-muted-foreground text-xs">Create your first form template to get started</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {adminTemplates.map((t) => renderCard(t))}
          </div>
        )}
      </section>

      {/* Client (customer-owned) templates */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h3 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Client templates</h3>
          <span className="font-mono text-[10px] text-muted-foreground">{clientTemplates.length}</span>
        </div>
        <p className="text-muted-foreground text-xs -mt-2">Built or forked by customers — owned by their organisation.</p>
        {clientTemplates.length === 0 ? (
          <Card className="bg-card border-border rounded-sm p-8 text-center">
            <p className="text-muted-foreground font-mono text-sm">No customer-built templates yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clientTemplates.map((t) => renderCard(t, t.owner_id ? ownerNameById.get(t.owner_id) : undefined))}
          </div>
        )}
      </section>
    </div>
  );
}

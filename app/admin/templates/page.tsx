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
      id, name, template_type, is_published, created_at,
      template_versions(version_number, published_at)
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      {/* Templates grid */}
      {!templates || templates.length === 0 ? (
        <Card className="bg-card border-border rounded-sm p-12 text-center">
          <p className="text-muted-foreground font-mono text-sm mb-4">No templates yet</p>
          <p className="text-muted-foreground text-xs">Create your first form template to get started</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => {
            const versions = (t.template_versions ?? []) as Array<{ version_number: number; published_at: string | null }>;
            const latestVersion = versions.sort((a, b) => b.version_number - a.version_number)[0];
            const publishedCount = versions.filter(v => v.published_at).length;
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
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

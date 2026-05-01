import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewTemplateButton } from "./_components/new-template-button";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: templates } = await supabase
    .from("form_templates")
    .select(`
      id, name, template_type, is_published, created_at,
      template_versions(version_number, published_at)
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-[#3b8273] font-semibold">07</span>
            FORM TEMPLATES
          </div>
          <h2 className="font-serif text-[32px] leading-tight text-white">
            Assessment Templates
          </h2>
        </div>
        <NewTemplateButton />
      </div>

      {/* Templates grid */}
      {!templates || templates.length === 0 ? (
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-12 text-center">
          <p className="text-white/40 font-mono text-sm mb-4">No templates yet</p>
          <p className="text-white/30 text-xs">Create your first form template to get started</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => {
            const versions = (t.template_versions ?? []) as Array<{ version_number: number; published_at: string | null }>;
            const latestVersion = versions.sort((a, b) => b.version_number - a.version_number)[0];
            const publishedCount = versions.filter(v => v.published_at).length;
            const hasDraft = latestVersion && !latestVersion.published_at;

            return (
              <Link key={t.id} href={`/admin/templates/${t.id}`}>
                <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 hover:border-white/10 hover:bg-[#222] transition-all cursor-pointer group">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5">
                        <h3 className="font-medium text-white group-hover:text-white/90 leading-tight">
                          {t.name}
                        </h3>
                        <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">
                          {t.template_type}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {t.is_published ? (
                          <Badge className="bg-[#3b8273]/20 text-[#3b8273] border-[#3b8273]/30 text-[10px] font-mono">
                            LIVE
                          </Badge>
                        ) : (
                          <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px] font-mono">
                            DRAFT
                          </Badge>
                        )}
                        {hasDraft && t.is_published && (
                          <Badge className="bg-[#c0a66d]/20 text-[#c0a66d] border-[#c0a66d]/30 text-[10px] font-mono">
                            UNPUBLISHED EDITS
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 font-mono text-[10px] text-white/30 uppercase tracking-wider border-t border-white/5 pt-4">
                      <span>v{latestVersion?.version_number ?? 1}</span>
                      <span>·</span>
                      <span>{publishedCount} published</span>
                      <span>·</span>
                      <span>{new Date(t.created_at).toLocaleDateString("en-GB")}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

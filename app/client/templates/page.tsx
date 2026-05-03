import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import Link from "next/link";
import { NewClientTemplateButton } from "./_components/new-client-template-button";

export const dynamic = "force-dynamic";

export default async function ClientTemplatesPage() {
  const supabase = await createClient();
  // ctx may be null in demo mode if client_users is empty — render the
  // Available section anyway and skip the My Templates query. Real-prod
  // unauthenticated traffic is already redirected to /login by proxy.ts.
  const ctx = await getClientContext();

  // TODO(phaseB): scope this through form_assignments so customers see only
  // templates Matt has actually assigned to them, not every admin master.
  // Available: admin-owned, published. RLS already scopes this in migration 004.
  const { data: assigned } = await supabase
    .from("form_templates")
    .select("id, name, template_type, created_at")
    .eq("owner_type", "admin")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const { data: mine } = ctx
    ? await supabase
        .from("form_templates")
        .select(`
          id, name, template_type, is_published, created_at, parent_template_id,
          template_versions(version_number, published_at)
        `)
        .eq("owner_type", "customer")
        .eq("owner_id", ctx.client_id)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[8px] tracking-[0.3em] uppercase font-bold text-[#8a857f]">
          <span>06</span>
          <span className="text-[#d8d4cc]">·</span>
          <span>Templates</span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h2 className="font-serif text-[32px] text-[#1a1a1a] font-medium tracking-tight leading-[1.05]">
            Form templates.
          </h2>
          <NewClientTemplateButton />
        </div>
      </section>

      {/* Assigned */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5e1d8] pb-2">
          <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-[#1a1a1a]">
            01 — Available Templates
          </h3>
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#8a857f]">
            {assigned?.length ?? 0} available
          </span>
        </div>
        {!assigned || assigned.length === 0 ? (
          <p className="text-[#8a857f] text-sm font-mono uppercase tracking-wider py-6">
            No templates available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assigned.map((t) => (
              <div key={t.id} className="bg-white border border-[#e5e1d8] rounded-sm p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h4 className="font-serif text-[18px] text-[#1a1a1a] leading-tight">{t.name}</h4>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">{t.template_type}</span>
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  {/*
                    "Fill" button is a placeholder for now — the client-side
                    form-fill route is a separate task. When wired, it should
                    open a fill UI that calls forkOnFill on save when structure
                    has changed. See app/client/templates/actions.ts:forkOnFill.
                  */}
                  <button
                    disabled
                    title="Form fill UI coming soon"
                    className="rounded-sm border border-[#e5e1d8] bg-transparent text-[#8a857f] h-9 px-5 font-bold text-[9px] uppercase tracking-[0.25em] cursor-not-allowed"
                  >
                    Fill (coming soon)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mine */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5e1d8] pb-2">
          <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-[#1a1a1a]">
            02 — My Templates
          </h3>
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#8a857f]">
            {mine?.length ?? 0} created
          </span>
        </div>
        {!mine || mine.length === 0 ? (
          <p className="text-[#8a857f] text-sm font-mono uppercase tracking-wider py-6">
            No templates yet — start one from the button above.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mine.map((t) => {
              const versions = (t.template_versions ?? []) as Array<{ version_number: number; published_at: string | null }>;
              const latest = versions.sort((a, b) => b.version_number - a.version_number)[0];
              return (
                <Link key={t.id} href={`/client/templates/${t.id}`}>
                  <div className="bg-white border border-[#e5e1d8] rounded-sm p-5 flex flex-col gap-4 hover:border-[#1a1a1a]/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <h4 className="font-serif text-[18px] text-[#1a1a1a] leading-tight truncate">{t.name}</h4>
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">
                          {t.template_type}
                          {t.parent_template_id && <span className="ml-2 text-[#c0a66d]">· FORKED</span>}
                        </span>
                      </div>
                      <span className={
                        t.is_published
                          ? "font-mono text-[9px] uppercase tracking-[0.25em] text-[#3b8273] bg-[#3b8273]/10 px-2 py-1 rounded-sm"
                          : "font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] bg-[#f5f3ee] px-2 py-1 rounded-sm"
                      }>
                        {t.is_published ? "Live" : "Draft"}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f] mt-auto">
                      v{latest?.version_number ?? 1} · {new Date(t.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

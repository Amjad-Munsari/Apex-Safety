import { fetchActiveContractors } from "@/lib/data/contractors-server";
import type { Contractor } from "@/lib/data/contractors";
import { DirectoryBrowser } from "./_components/directory-browser";
import { failedClientLoad } from "@/lib/observability/failed-client-load";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  let contractors: Contractor[] = []
  let loadError: unknown = null
  try {
    contractors = await fetchActiveContractors();
  } catch (err) {
    loadError = err
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ─── PAGE HEADER ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            06 Approved Contractors
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-foreground font-normal tracking-tight leading-[1.05]">
          Contractor Directory.
        </h2>
        <p className="font-sans text-[13px] text-muted-foreground max-w-xl leading-relaxed">
          Contractors vetted and approved by your consultant for remedial works following your assessments.
        </p>
      </section>

      {loadError ? (
        failedClientLoad({
          area: "client.directory.load",
          itemName: "contractor directory",
          error: loadError,
        })
      ) : (
        <DirectoryBrowser contractors={contractors} />
      )}
    </div>
  );
}

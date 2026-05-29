export const dynamic = "force-dynamic";

export default function ClientContractsPage() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[#3b8273] tracking-[0.4em] uppercase font-medium">
            08 · Contracts
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Service agreements.
        </h2>
      </section>

      <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
        <p className="font-serif text-[20px] text-[#1a1a1a] mb-3">No contracts yet.</p>
        <p className="font-sans text-[13px] text-[#8a857f] max-w-md mx-auto leading-relaxed">
          Counter-signed service agreements will appear here once your proposal is accepted and issued
          by 888 Safety &amp; Training.
        </p>
      </div>
    </div>
  );
}

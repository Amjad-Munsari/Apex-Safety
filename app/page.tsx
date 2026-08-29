import Link from "next/link";
import { ShieldCheck, Users, ArrowRight, Eye } from "lucide-react";
import { PLATFORM_NAME } from "@/lib/public-identity";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-41px)] flex flex-col bg-[#fbfaf5]">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-mono text-[10px] uppercase font-semibold tracking-wider border border-emerald-500/20 mb-4">
            <Eye className="w-3 h-3" /> Portfolio Showcase
          </div>
          <h1 className="font-serif text-[36px] sm:text-[42px] text-[#1a1a1a] tracking-tight leading-[1.1]">
            {PLATFORM_NAME}
          </h1>
          <p className="font-mono text-[10px] tracking-[0.3em] text-[#3b8273] uppercase font-bold mt-3">
            Fire Safety &amp; Compliance Platform
          </p>
          <p className="text-[#6b6b6b] text-[14px] leading-relaxed mt-4 max-w-[560px] mx-auto font-sans">
            Interactive demo — explore the full platform without login. Choose a workspace to begin. Use the top bar to switch between portals at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[720px]">
          {/* Admin Console */}
          <Link
            href="/admin"
            className="group relative flex flex-col bg-[#111] border border-white/10 rounded-lg p-7 sm:p-8 hover:bg-[#1a1a1a] transition-colors"
          >
            <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mb-5">
              <ShieldCheck className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="font-serif text-[22px] text-white tracking-tight leading-tight">
              Admin Console
            </h2>
            <p className="text-white/50 text-[13px] leading-relaxed mt-2 font-sans">
              Manage clients, track expiring documents, review reports and generate proposals.
            </p>
            <span className="inline-flex items-center gap-1.5 mt-6 text-[12px] font-medium text-white group-hover:text-white transition-colors">
              Enter Admin Console <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <span className="absolute top-4 right-4 font-mono text-[9px] tracking-widest text-white/20 uppercase">Operator</span>
          </Link>

          {/* Client Portal */}
          <Link
            href="/client"
            className="group flex flex-col bg-white border border-[#e5e1d8] rounded-lg p-7 sm:p-8 hover:border-[#d5d0c6] hover:bg-[#fefefe] transition-colors shadow-sm"
          >
            <div className="w-10 h-10 rounded-full border border-black/10 bg-white flex items-center justify-center mb-5 shadow-sm">
              <Users className="w-5 h-5 text-[#1a1a1a]" />
            </div>
            <h2 className="font-serif text-[22px] text-[#1a1a1a] tracking-tight leading-tight">
              Client Portal
            </h2>
            <p className="text-[#6b6b6b] text-[13px] leading-relaxed mt-2 font-sans">
              View compliance, expiring documents, assessments and reports for your organisation.
            </p>
            <span className="inline-flex items-center gap-1.5 mt-6 text-[12px] font-medium text-[#1a1a1a] group-hover:text-[#111] transition-colors">
              Enter Client Portal <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <span className="absolute top-4 right-4 font-mono text-[9px] tracking-widest text-[#aaa] uppercase">Client</span>
          </Link>
        </div>

        <p className="font-mono text-[10px] tracking-[0.2em] text-[#aaa] uppercase mt-8 text-center">
          No login required — use the top bar to switch anytime
        </p>
      </div>

      <footer className="px-6 py-4 border-t border-[#e5e1d8] bg-white/50">
        <div className="max-w-[720px] mx-auto flex flex-wrap justify-center items-center gap-x-3 gap-y-1 font-mono text-[8.5px] tracking-[0.2em] text-muted-foreground uppercase">
          <span>{PLATFORM_NAME}</span>
          <span>·</span>
          <span>Portfolio Prototype</span>
          <span>·</span>
          <span className="text-muted-foreground/60">Full feature exploration without login</span>
        </div>
      </footer>
    </div>
  );
}

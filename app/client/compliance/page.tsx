"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  FileText, 
  AlertCircle, 
  Download,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Document {
  id: string;
  title: string;
  size: string;
  issued: string;
  expires: string | null;
  status: "CURRENT" | "EXPIRING" | "EXPIRED";
}

interface Category {
  name: string;
  count: number;
  documents: Document[];
}

const complianceData: Category[] = [
  {
    name: "FIRE SAFETY",
    count: 5,
    documents: [
      { id: "DOC-1408", title: "Fire Risk Assessment (Type 3) — Main Building", size: "4.2MB", issued: "22 Nov 2024", expires: "22 Nov 2025", status: "EXPIRED" },
      { id: "DOC-1409", title: "Fire Risk Assessment (Type 1) — Annex Wing", size: "2.1MB", issued: "22 Nov 2024", expires: "22 Nov 2026", status: "CURRENT" },
      { id: "DOC-1510", title: "Fire Extinguisher Service Certificate", size: "0.6MB", issued: "14 Feb 2026", expires: "14 Feb 2027", status: "CURRENT" },
      { id: "DOC-1489", title: "Fire Warden Training — 4 staff", size: "1.3MB", issued: "08 Jan 2026", expires: "08 Jan 2029", status: "CURRENT" },
      { id: "DOC-1462", title: "Emergency Lighting Test Certificate", size: "0.4MB", issued: "02 Oct 2025", expires: "02 Oct 2026", status: "CURRENT" },
    ]
  },
  {
    name: "ELECTRICAL",
    count: 2,
    documents: [
      { id: "DOC-0941", title: "EICR 2024 — Electrical Installation Condition Report", size: "3.8MB", issued: "03 Apr 2021", expires: "03 Apr 2026", status: "EXPIRED" },
      { id: "DOC-1511", title: "PAT Testing Certificate — 42 items", size: "0.9MB", issued: "10 Mar 2026", expires: "10 Mar 2027", status: "CURRENT" },
    ]
  },
  {
    name: "TRAINING",
    count: 2,
    documents: [
      { id: "DOC-1344", title: "First Aid at Work — 3 staff", size: "0.7MB", issued: "14 May 2024", expires: "14 May 2027", status: "CURRENT" },
      { id: "DOC-1488", title: "Manual Handling Training", size: "0.5MB", issued: "08 Jan 2026", expires: "08 Jan 2028", status: "CURRENT" },
    ]
  },
  {
    name: "WATER HYGIENE",
    count: 2,
    documents: [
      { id: "DOC-0903", title: "Legionella Risk Assessment", size: "2.4MB", issued: "19 Jun 2024", expires: "19 Jun 2026", status: "EXPIRING" },
      { id: "DOC-1512", title: "Water Temperature Monitoring Log (Q1)", size: "0.3MB", issued: "31 Mar 2026", expires: null, status: "CURRENT" },
    ]
  },
  {
    name: "STRUCTURAL",
    count: 2,
    documents: [
      { id: "DOC-0712", title: "Asbestos Management Survey", size: "5.6MB", issued: "15 Aug 2022", expires: null, status: "CURRENT" },
      { id: "DOC-1455", title: "Gas Safety Certificate", size: "0.3MB", issued: "02 Sep 2025", expires: "02 Sep 2026", status: "EXPIRING" },
    ]
  }
];

export default function CompliancePage() {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ─── PAGE HEADER ─── */}
      <section className="space-y-2">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[9px] text-[#3b8273] tracking-[0.3em] font-bold uppercase">02 By Category</span>
        </div>
        <h2 className="font-serif text-[38px] text-[#1a1a1a] font-medium tracking-tight leading-[1.1]">
          Your compliance documents.
        </h2>
      </section>

      {/* ─── CATEGORY GROUPS ─── */}
      <div className="space-y-12">
        {complianceData.map((category) => (
          <section key={category.name} className="space-y-5">
            {/* Category Header */}
            <div className="flex items-baseline gap-3">
              <h3 className="font-mono text-[9px] tracking-[0.3em] font-bold text-[#1a1a1a] uppercase">{category.name}</h3>
              <span className="font-mono text-[9px] text-[#bbb] font-medium tracking-[0.1em]">{category.count} documents</span>
            </div>

            {/* Document Card */}
            <div className="bg-white border border-[#e5e1d8] rounded-sm divide-y divide-[#f0ede6] shadow-sm overflow-hidden">
              {category.documents.map((doc) => (
                <div key={doc.id} className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6 group hover:bg-[#faf9f6]/80 transition-all">
                  
                  {/* Left: Info */}
                  <div className="flex-1 min-w-[300px]">
                    <h4 className="font-sans font-extrabold text-[15px] text-[#1a1a1a] tracking-tight group-hover:text-black">
                      {doc.title}
                    </h4>
                    <div className="flex items-center gap-4 font-mono text-[8px] tracking-[0.25em] text-[#999] uppercase font-bold mt-1">
                      <span>{doc.id}</span>
                      <span className="opacity-30">&middot;</span>
                      <span>{doc.size}</span>
                    </div>
                  </div>

                  {/* Center: Issued/Expires */}
                  <div className="flex items-center gap-12 shrink-0">
                    <div className="space-y-1 w-24">
                      <span className="font-mono text-[8px] uppercase tracking-[0.2em] font-bold text-[#bbb] block">Issued</span>
                      <span className="font-mono text-[9px] font-bold text-[#1a1a1a] tracking-tight whitespace-nowrap">{doc.issued}</span>
                    </div>
                    <div className="space-y-1 w-24">
                      <span className="font-mono text-[8px] uppercase tracking-[0.2em] font-bold text-[#bbb] block">Expires</span>
                      <span className="font-mono text-[9px] font-bold text-[#1a1a1a] tracking-tight whitespace-nowrap">
                        {doc.expires || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Status & Action */}
                  <div className="flex items-center gap-5 shrink-0">
                    <div className={cn(
                      "px-3 py-1.5 border rounded-full font-mono text-[8px] uppercase tracking-[0.2em] font-bold leading-none flex items-center gap-2 min-w-[90px] justify-center",
                      doc.status === "EXPIRED" ? "border-[#8b2b21] text-[#8b2b21] bg-transparent" : 
                      doc.status === "EXPIRING" ? "border-[#c0a66d] text-[#c0a66d] bg-transparent" :
                      "border-[#3b8273] text-[#3b8273] bg-transparent"
                    )}>
                      <div className={cn(
                        "w-1 h-1 rounded-full",
                        doc.status === "EXPIRED" ? "bg-[#8b2b21]" : 
                        doc.status === "EXPIRING" ? "bg-[#c0a66d]" : 
                        "bg-[#3b8273]"
                      )}></div>
                      {doc.status.split('').join(' ')}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger render={(props) => (
                        <div className="flex items-center border border-[#e5e1d8] rounded-sm group/btn overflow-hidden">
                          <Button {...props} variant="ghost" className="rounded-none border-r border-[#e5e1d8] bg-transparent text-[#1a1a1a] hover:bg-[#f9f8f6] h-10 px-4 flex flex-col items-center justify-center gap-0.5 group/btn font-mono text-[8px] font-bold uppercase tracking-[0.1em] shadow-none">
                            <span className="text-[10px]">Download</span>
                            <span className="text-[#999] opacity-70 group-hover/btn:text-black">PDF</span>
                          </Button>
                          <Button {...props} variant="ghost" className="rounded-none h-10 w-8 px-0 flex items-center justify-center hover:bg-[#f9f8f6]">
                             <ChevronDown className="h-3 w-3 opacity-30 group-hover/btn:opacity-100 transition-opacity" />
                          </Button>
                        </div>
                      )} />
                      <DropdownMenuContent align="end" className="rounded-sm border-[#e5e1d8] p-1.5">
                        <DropdownMenuItem className="text-[10px] font-mono font-bold uppercase tracking-widest p-2 cursor-pointer h-10 flex items-center gap-3">
                           <Download className="h-3 w-3" /> Download Result
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[10px] font-mono font-bold uppercase tracking-widest p-2 cursor-pointer h-10 flex items-center gap-3">
                           <ExternalLink className="h-3 w-3" /> View Online
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

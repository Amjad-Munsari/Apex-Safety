import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ComplianceChart } from "./compliance-chart";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch real clients for the list with related data
  const { data: clients } = await supabase
    .from("clients")
    .select(`
      *,
      documents (
        expiry_date,
        document_category,
        filename
      ),
      proposals (
        status
      )
    `)
    .order("name", { ascending: true })
    .limit(8);

  const complianceData = [
    { name: 'Current', value: 27, color: '#3b8273' },
    { name: 'Expiring', value: 12, color: '#d4a373' },
    { name: 'Expired', value: 11, color: '#e63946' },
  ];
  return (
    <div className="flex flex-col gap-10 pb-20">
      
      {/* ─── GREETING & STATS HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-[#3b8273] font-semibold">01</span>
            SINGLE PANE OF GLASS
          </div>
          <h2 className="font-serif text-[32px] md:text-[34px] leading-tight text-[#aaa] whitespace-nowrap">
            <span className="text-white">Good morning, Matt.</span> <span className="text-white">3</span> items need you today.
          </h2>
        </div>
        
        <div className="flex gap-12 text-right">
          <div className="flex flex-col items-end gap-1">
             <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Drafts to review</div>
             <div className="font-serif text-3xl text-gold">3</div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Overdue docs</div>
             <div className="font-serif text-3xl text-danger">1</div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Expiring (30d)</div>
             <div className="font-serif text-3xl text-gold">6</div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Workflow errors</div>
             <div className="font-serif text-3xl text-danger">3</div>
          </div>
        </div>
      </div>

      {/* ─── ROW 1: 01 CLIENTS + 04 REPORTS (Left) & 02 UPCOMING (Right) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          {/* 01 CLIENTS */}
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden flex flex-col max-h-[420px]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/40">01</span>
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Clients</h3>
                <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">{clients?.length || 0} Active</span>
              </div>
              <Link href="/admin/clients/new" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">
                + New client
              </Link>
            </div>
            
            <div className="w-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
               <table className="w-full text-left font-sans text-sm">
                  <thead className="bg-[#151515]">
                    <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                      <th className="font-normal px-6 py-3 border-b border-white/5">Client</th>
                      <th className="font-normal px-4 py-3 border-b border-white/5">Rag</th>
                      <th className="font-normal px-4 py-3 border-b border-white/5 text-right">Hours</th>
                      <th className="font-normal px-4 py-3 border-b border-white/5">Next Expiry</th>
                      <th className="font-normal px-4 py-3 border-b border-white/5">Proposal</th>
                      <th className="font-normal px-6 py-3 border-b border-white/5 text-right text-transparent">Sites</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {clients?.map((client) => {
                      // Calculate next expiry
                      const expiries = client.documents
                        ?.map(d => ({ date: new Date(d.expiry_date), cat: d.document_category }))
                        .filter(d => !isNaN(d.date.getTime()))
                        .sort((a, b) => a.date.getTime() - b.date.getTime());
                      
                      const nextExpiry = expiries?.[0];
                      const proposalStatus = client.proposals?.[0]?.status;

                      // Calculate RAG status based on expiry
                      const today = new Date();
                      const daysUntil = nextExpiry ? Math.ceil((nextExpiry.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                      
                      let ragLabel = "Current";
                      let ragColor = "success";
                      if (daysUntil !== null) {
                        if (daysUntil < 0) { ragLabel = "Expired"; ragColor = "danger"; }
                        else if (daysUntil < 30) { ragLabel = "Expiring"; ragColor = "gold"; }
                      }

                      return (
                        <tr key={client.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer relative">
                          <td className="px-6 py-4">
                             <Link href={`/admin/clients/${client.id}`} className="absolute inset-0 z-0" />
                             <div className="flex items-start gap-4 relative z-10 pointer-events-none">
                               <span className="font-mono text-[10px] text-[#555] mt-1 w-10">CL-<br/>{client.id.slice(0, 4).toUpperCase()}</span>
                               <div>
                                 <div className="font-medium text-white mb-0.5">{client.name}</div>
                                 <div className="text-xs text-white/40">Client Record</div>
                               </div>
                             </div>
                          </td>
                          <td className="px-4 py-4">
                             <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 border border-${ragColor}/40 rounded text-${ragColor} text-[10px] font-mono uppercase tracking-wider bg-${ragColor}/5 leading-none`}>
                               <div className={`w-1.5 h-1.5 rounded-full bg-${ragColor}`}></div> {ragLabel}
                             </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-white/70 text-right">{client.hours_balance}h</td>
                          <td className="px-4 py-4">
                             <div className="text-white text-sm mb-0.5">{nextExpiry ? nextExpiry.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}</div>
                             <div className="text-xs text-[#666]">{nextExpiry?.cat || "No upcoming"}</div>
                          </td>
                          <td className="px-4 py-4">
                             <div className={`inline-flex px-2.5 py-1 border border-${proposalStatus ? (proposalStatus === 'Signed' ? '#3b8273' : 'gold') : 'white'}/40 text-${proposalStatus ? (proposalStatus === 'Signed' ? '#3b8273' : 'gold') : 'white'}/60 text-[10px] font-mono uppercase tracking-wider rounded leading-none`}>
                               {proposalStatus || "None"}
                             </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-right text-white/50">{client.documents?.length || 0} <span className="ml-2 text-white/20">&gt;</span></td>
                        </tr>
                      );
                    })}
                    {!clients || clients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
                          No clients found in database
                        </td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </Card>

          {/* 03 REPORTS AWAITING REVIEW */}
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden flex flex-col pb-4">
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/40">03</span>
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Reports awaiting review</h3>
                <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">3 Drafts</span>
              </div>
              <a href="#" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">View queue</a>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-white/5 mt-2">
               {/* Card 1 */}
               <div className="p-6 flex flex-col gap-3 group relative">
                 <div className="font-mono text-[10px] uppercase tracking-widest text-[#666]">Today &middot; 09:58</div>
                 <div>
                   <div className="font-medium text-white mb-1">Merlin Print Works Ltd</div>
                   <div className="text-xs text-[#888] leading-relaxed">Unit 7, Ardwick — FRA — Type 3<br/>18 photos &middot; 2140w</div>
                 </div>
                 <Button variant="secondary" className="bg-white text-black text-xs font-medium w-fit mt-2 rounded-[2px] h-8 px-4">Review &rarr;</Button>
               </div>
               {/* Card 2 */}
               <div className="p-6 flex flex-col gap-3 group relative">
                 <div className="font-mono text-[10px] uppercase tracking-widest text-[#666]">Today &middot; 08:12</div>
                 <div>
                   <div className="font-medium text-white mb-1">Argyll Self-Storage</div>
                   <div className="text-xs text-[#888] leading-relaxed">Loch Road — Site B - Site Risk Assessment<br/>11 photos &middot; 1680w</div>
                 </div>
                 <Button variant="secondary" className="bg-white text-black text-xs font-medium w-fit mt-2 rounded-[2px] h-8 px-4">Review &rarr;</Button>
               </div>
               {/* Card 3 */}
               <div className="p-6 flex flex-col gap-3 group relative">
                 <div className="font-mono text-[10px] uppercase tracking-widest text-[#666]">Yesterday &middot; 16:40</div>
                 <div>
                   <div className="font-medium text-white mb-1">Brooklyn Bakery</div>
                   <div className="text-xs text-[#888] leading-relaxed">Beach Rd, Chorlton &middot; FRA — Type 1<br/>8 photos &middot; 1320w</div>
                 </div>
                 <Button variant="secondary" className="bg-white text-black text-xs font-medium w-fit mt-2 rounded-[2px] h-8 px-4">Review &rarr;</Button>
               </div>
            </div>
          </Card>
        </div>

        {/* 02 UPCOMING EXPIRIES */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/40">02</span>
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Upcoming expiries</h3>
              </div>
              <a href="#" className="font-mono text-[10px] uppercase tracking-widest text-[#aaa] hover:text-white border-b border-[#aaa] pb-0.5">View all</a>
            </div>

           <div className="flex flex-col gap-6">
             {/* Group 1 */}
             <div>
                 <div className="flex items-center gap-4 mb-4">
                   <div className="px-3 py-1 bg-white/5 border-l-2 border-danger text-white/80 font-mono text-[10px] uppercase tracking-widest leading-none">0-7 Days</div>
                   <div className="font-mono text-[10px] text-danger/40 uppercase tracking-widest">3 Items</div>
                 </div>
                <div className="flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-4">
                     <div>
                       <div className="text-white text-sm font-medium mb-1">EICR</div>
                       <div className="text-xs text-[#888]">Hallam House Care Home <span className="font-mono ml-1">03 APR 2026</span></div>
                     </div>
                     <div className="inline-flex items-center px-2.5 py-1 border border-danger bg-danger text-black text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none"><div className="w-1.5 h-1.5 rounded-full bg-black mr-1.5"></div> 15d overdue</div>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                     <div>
                       <div className="text-white text-sm font-medium mb-1">Legionella Risk Assessment</div>
                       <div className="text-xs text-[#888]">Oakwood Letting Agency <span className="font-mono ml-1">21 APR 2026</span></div>
                     </div>
                     <div className="inline-flex items-center px-2.5 py-1 text-danger border border-danger/40 text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none"><div className="w-1.5 h-1.5 rounded-full bg-danger mr-1.5"></div> 3d left</div>
                  </div>
                  <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-5">
                     <div>
                       <div className="text-white text-sm font-medium mb-1">PAT Testing Certificate</div>
                       <div className="text-xs text-[#888]">Merlin Print Works Ltd <span className="font-mono ml-1">24 APR 2026</span></div>
                     </div>
                     <div className="inline-flex items-center px-2.5 py-1 text-danger border border-danger/40 text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none"><div className="w-1.5 h-1.5 rounded-full bg-danger mr-1.5"></div> 6d left</div>
                  </div>
                </div>
             </div>

             {/* Group 2 */}
             <div>
                 <div className="flex items-center gap-4 mb-4">
                   <div className="px-3 py-1 bg-white/5 border-l-2 border-gold/60 text-white/80 font-mono text-[10px] uppercase tracking-widest leading-none">8-14 Days</div>
                   <div className="font-mono text-[10px] text-white/20 uppercase tracking-widest">1 Item</div>
                 </div>
                <div className="flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-5">
                     <div>
                       <div className="text-white text-sm font-medium mb-1">Fire Extinguisher Service</div>
                       <div className="text-xs text-[#888]">Argyll Self-Storage <span className="font-mono ml-1">29 APR 2026</span></div>
                     </div>
                     <div className="inline-flex items-center px-2.5 py-1 text-danger border border-danger/40 text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none"><div className="w-1.5 h-1.5 rounded-full bg-danger mr-1.5"></div> 11d left</div>
                  </div>
                </div>
             </div>

             {/* Group 3 */}
             <div>
                 <div className="flex items-center gap-4 mb-4">
                   <div className="px-3 py-1 bg-white/5 border-l-2 border-white/20 text-white/80 font-mono text-[10px] uppercase tracking-widest leading-none">15-30 Days</div>
                   <div className="font-mono text-[10px] text-white/20 uppercase tracking-widest">2 Items</div>
                 </div>
                <div className="flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-4">
                     <div>
                       <div className="text-white text-sm font-medium mb-1">Emergency Lighting Test</div>
                       <div className="text-xs text-[#888]">Parkgate Primary School <span className="font-mono ml-1">08 MAY 2026</span></div>
                     </div>
                     <div className="inline-flex items-center px-2.5 py-1 text-gold border border-gold/40 text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none"><div className="w-1.5 h-1.5 rounded-full bg-gold mr-1.5"></div> 20d left</div>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                     <div>
                       <div className="text-white text-sm font-medium mb-1">Fire Warden Training</div>
                       <div className="text-xs text-[#888]">Rowan &amp; Ashe Solicitors <span className="font-mono ml-1">14 MAY 2026</span></div>
                     </div>
                     <div className="inline-flex items-center px-2.5 py-1 text-gold border border-gold/40 text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none"><div className="w-1.5 h-1.5 rounded-full bg-gold mr-1.5"></div> 26d left</div>
                  </div>
                </div>
             </div>
           </div>
        </Card>
      </div>

      {/* ─── ROW 2: 04 COMPLIANCE + 06 PROPOSALS + 05 HOURS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 04 COMPLIANCE STATUS */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col h-[400px]">
           <div className="flex items-center gap-3 mb-6">
             <span className="font-mono text-xs text-white/40">04</span>
             <h3 className="font-sans font-medium text-white tracking-wide text-lg">Compliance status</h3>
             <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">50 Docs</span>
           </div>
           
           <ComplianceChart data={complianceData} />

           <div className="flex justify-center gap-6 mt-4 font-mono text-[10px] text-white/80">
              <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#3b8273]"></div> Current 27
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#d4a373]"></div> Expiring 12
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#e63946]"></div> Expired 11
              </div>
           </div>
        </Card>

        {/* 05 HOURS BALANCES */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden p-6 flex flex-col">
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <span className="font-mono text-xs text-white/40">05</span>
               <h3 className="font-sans font-medium text-white tracking-wide text-lg">Hours balances</h3>
             </div>
             <a href="#" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">See all</a>
           </div>
           
           <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Hallam House</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-gold" style={{width: '10%'}}></div>
                 </div>
                 <span className="font-mono text-danger w-8 text-right">0.5h</span>
              </div>
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Oakwood Letting</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-gold" style={{width: '20%'}}></div>
                 </div>
                 <span className="font-mono text-danger w-8 text-right">2.8h</span>
              </div>
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Merlin Print</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-gold" style={{width: '25%'}}></div>
                 </div>
                 <span className="font-mono text-danger w-8 text-right">3.5h</span>
              </div>
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Argyll Self-Storage</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-gold" style={{width: '30%'}}></div>
                 </div>
                 <span className="font-mono text-danger w-8 text-right">4.0h</span>
              </div>
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Brooklyn Bakery</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-[#555]" style={{width: '45%'}}></div>
                 </div>
                 <span className="font-mono text-white/50 w-8 text-right">6.0h</span>
              </div>
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Parkgate Primary</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-[#555]" style={{width: '60%'}}></div>
                 </div>
                 <span className="font-mono text-white/50 w-8 text-right">8.5h</span>
              </div>
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Stockley Joinery</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-[#555]" style={{width: '90%'}}></div>
                 </div>
                 <span className="font-mono text-white/50 w-8 text-right">18.5h</span>
              </div>
              <div className="flex items-center text-xs">
                 <span className="w-1/3 truncate text-white/80">Rowan &amp;</span>
                 <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className="h-full bg-[#555]" style={{width: '75%'}}></div>
                 </div>
                 <span className="font-mono text-white/50 w-8 text-right">14.0h</span>
              </div>
           </div>

           <div className="flex gap-4 items-center mt-auto text-[10px] font-mono text-[#555] pt-4">
             <div className="flex items-center gap-2"><div className="w-2 h-2 bg-gold"></div> &lt;5h</div>
             <div className="flex items-center gap-2"><div className="w-2 h-2 bg-danger"></div> 0h</div>
           </div>
        </Card>

        {/* 06 ACTIVE PROPOSALS */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col">
           <div className="flex justify-between items-start mb-8">
             <div className="flex items-start gap-3">
               <span className="font-mono text-xs text-white/40">06</span>
               <div>
                 <h3 className="font-sans font-medium text-white tracking-wide text-lg">Active proposals</h3>
                 <div className="font-mono text-[10px] text-[#666] uppercase tracking-widest mt-1.5 leading-relaxed">4 In Pipeline &middot;<br/>£6,840 Weighted</div>
               </div>
             </div>
             <a href="#" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white border-b border-white/20 pb-0.5">Open Pipeline</a>
           </div>

           <div className="flex flex-col relative before:absolute before:left-3.5 before:top-4 before:bottom-6 before:w-[1px] before:bg-white/10 gap-8 ml-2">
             {/* Item 1 */}
             <div className="relative flex items-center gap-6">
                <div className="w-7 h-7 rounded-full border border-white/20 bg-[#1c1c1c] flex items-center justify-center font-mono text-xs text-white z-10 shrink-0">1</div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] tracking-widest text-[#888] uppercase">Draft</div>
                  <div className="text-white text-sm font-sans mt-0.5">£640</div>
                </div>
                <span className="text-white/20 font-mono text-sm">&gt;</span>
             </div>
             {/* Item 2 */}
             <div className="relative flex items-center gap-6">
                <div className="w-7 h-7 rounded-full border border-white/20 bg-[#1c1c1c] flex items-center justify-center font-mono text-xs text-white z-10 shrink-0">1</div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] tracking-widest text-[#888] uppercase">Sent</div>
                  <div className="text-white text-sm font-sans mt-0.5">£1,840</div>
                </div>
                <span className="text-white/20 font-mono text-sm">&gt;</span>
             </div>
             {/* Item 3 */}
             <div className="relative flex items-center gap-6">
                <div className="w-7 h-7 rounded-full border border-white/20 bg-[#1c1c1c] flex items-center justify-center font-mono text-xs text-white z-10 shrink-0">1</div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] tracking-widest text-[#888] uppercase">Signed</div>
                  <div className="text-white text-sm font-sans mt-0.5">£1,240</div>
                </div>
                <span className="text-white/20 font-mono text-sm">&gt;</span>
             </div>
             {/* Item 4 */}
             <div className="relative flex items-center gap-6">
                <div className="w-7 h-7 rounded-full border border-white/20 bg-[#1c1c1c] flex items-center justify-center font-mono text-xs text-white z-10 shrink-0">1</div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] tracking-widest text-[#888] uppercase">Contract Issued</div>
                  <div className="text-white text-sm font-sans mt-0.5">£3,120</div>
                </div>
             </div>
           </div>
        </Card>
      </div>

      {/* ─── ROW 3: 07 WORKFLOW ERRORS (Left) & 08 THIS MONTH (Right) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
         {/* 07 WORKFLOW ERRORS */}
         <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col">
           <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
             <div className="flex items-center gap-3">
               <span className="font-mono text-xs text-white/40">07</span>
               <h3 className="font-sans font-medium text-white tracking-wide text-lg">Workflow errors</h3>
               <span className="font-mono text-[10px] text-danger border border-danger/20 rounded-full text-[9px] font-mono uppercase tracking-widest ml-3 bg-white/5 px-2.5 py-1 leading-none">3 Failing</span>
             </div>
             <a href="#" className="font-mono text-[10px] uppercase tracking-widest text-[#aaa] hover:text-white border-b border-[#aaa] pb-0.5">Open Log</a>
           </div>

            <div className="flex flex-col text-xs font-mono divide-y divide-white/5">
               <div className="flex items-start md:items-center gap-4 py-4 first:pt-0 last:pb-0">
                 <span className="w-24 shrink-0 text-[#666]">11 min ago</span>
                 <div className="w-24 shrink-0 px-2 py-0.5 border border-danger/20 rounded-[2px] text-danger text-[10px] text-center font-bold">E_TIMEOUT</div>
                 <span className="flex-1 truncate text-white/90 italic">“report_generate” <span className="text-white/40 not-italic ml-2">— PDF render timed out after 120s</span></span>
                 <span className="text-danger tracking-widest uppercase cursor-pointer hover:text-danger/80 border-b border-danger/20 pb-0.5 text-[9px] font-bold ml-4">Retry</span>
               </div>
               <div className="flex items-start md:items-center gap-4 py-4 first:pt-0 last:pb-0">
                 <span className="w-24 shrink-0 text-[#666]">43 min ago</span>
                 <div className="w-24 shrink-0 px-2 py-0.5 border border-danger/20 rounded-[2px] text-danger text-[10px] text-center font-bold">SMTP_550</div>
                 <span className="flex-1 truncate text-white/90 italic">“email_send” <span className="text-white/40 not-italic ml-2">— Recipient address rejected</span></span>
                 <span className="text-danger tracking-widest uppercase cursor-pointer hover:text-danger/80 border-b border-danger/20 pb-0.5 text-[9px] font-bold ml-4">Retry</span>
               </div>
               <div className="flex items-start md:items-center gap-4 py-4 first:pt-0 last:pb-0">
                 <span className="w-24 shrink-0 text-[#666]">6 h ago</span>
                 <div className="w-24 shrink-0 px-2 py-0.5 border border-danger/20 rounded-[2px] text-danger text-[10px] text-center font-bold">E_AUTH</div>
                 <span className="flex-1 truncate text-white/90 italic">“expiry_cron” <span className="text-white/40 not-italic ml-2">— Companies House API token expired</span></span>
                 <span className="text-danger tracking-widest uppercase cursor-pointer hover:text-danger/80 border-b border-danger/20 pb-0.5 text-[9px] font-bold ml-4">Retry</span>
               </div>
            </div>
         </Card>

         {/* 08 THIS MONTH */}
         <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col">
           <div className="flex items-center gap-3 mb-8">
             <span className="font-mono text-xs text-white/40">08</span>
             <h3 className="font-sans font-medium text-white tracking-wide text-lg">This month</h3>
             <span className="font-mono text-[10px] text-white/50 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest ml-3 bg-white/5 px-2.5 py-1 leading-none">April 2026</span>
           </div>
           
           <div className="grid grid-cols-2 gap-y-10 gap-x-6">
             <div>
               <div className="font-serif text-3xl text-white mb-2">24</div>
               <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Assessments<br/>completed</div>
             </div>
             <div>
               <div className="font-serif text-3xl text-white mb-2">18</div>
               <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Reports<br/>delivered</div>
             </div>
             <div>
               <div className="font-serif text-3xl text-white mb-2">165</div>
               <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Hours<br/>sold</div>
             </div>
             <div>
               <div className="font-serif text-3xl text-white mb-2">3</div>
               <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Proposals<br/>signed</div>
             </div>
           </div>
         </Card>
      </div>
    </div>
  );
}

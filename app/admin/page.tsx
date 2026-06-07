import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ComplianceChart } from "./compliance-chart";
import { describeWorkflowError } from "@/lib/workflow-errors";
import {
  getDashboardStats,
  getReportsAwaitingReview,
  getUpcomingExpiries,
  getComplianceAggregates,
  getWorkflowErrors
} from "@/lib/supabase/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch live dashboard metrics
  const stats = await getDashboardStats();
  const reviewQueue = await getReportsAwaitingReview();
  const upcomingExpiries = await getUpcomingExpiries(6);
  const compliance = await getComplianceAggregates();
  const recentErrors = await getWorkflowErrors();

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
    .limit(50);

  // Fetch ALL proposals for the pipeline summary counts
  const { data: allProposals } = await supabase
    .from("proposals")
    .select("status");

  const complianceData = [
    { name: 'Current', value: compliance.current, color: 'var(--teal)' },
    { name: 'Expiring', value: compliance.expiring, color: '#d4a373' },
    { name: 'Expired', value: compliance.expired, color: '#e63946' },
  ];
  return (
    <div className="flex flex-col gap-10 pt-8 pb-20">

      {/* ─── GREETING & STATS HEADER ─── */}
      <div className="flex justify-between items-end gap-8 min-w-0 animate-in-fade [animation-delay:0.1s]">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-teal font-semibold">01</span>
            SINGLE PANE OF GLASS
          </div>
          <h2 className="font-serif text-[26px] md:text-[30px] leading-tight text-[#aaa]">
            <span className="text-white">Welcome back, Matt.</span> {stats.totalItemsNeeded} {stats.totalItemsNeeded === 1 ? 'item needs' : 'items need'} you today.
          </h2>
        </div>

        <div className="flex gap-6 lg:gap-8 text-right shrink-0">
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Drafts to review</div>
            <div className="font-serif text-3xl text-gold">{stats.reviewCount}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Overdue docs</div>
            <div className="font-serif text-3xl text-danger">{stats.overdueCount}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Expiring (30d)</div>
            <div className="font-serif text-3xl text-gold">{stats.expiringCount}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#555]">Workflow errors</div>
            <div className="font-serif text-3xl text-danger">{stats.errorCount}</div>
          </div>
        </div>
      </div>

      {/* ─── ROW 1: 01 CLIENTS + 04 REPORTS (Left) & 02 UPCOMING (Right) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          {/* 01 CLIENTS */}
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden flex flex-col max-h-[420px] animate-in-fade [animation-delay:0.2s]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/40">01</span>
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Clients</h3>
                <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">{clients?.length || 0} Active</span>
              </div>
              <Link href="/admin/clients" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">
                View all
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
                    type DocRow = { expiry_date: string | null; document_category: string | null };
                    const expiries = (client.documents as DocRow[] | null)
                      ?.map((d) => ({ date: new Date(d.expiry_date ?? ""), cat: d.document_category }))
                      .filter((d) => !isNaN(d.date.getTime()))
                      .sort((a, b) => a.date.getTime() - b.date.getTime());

                    const nextExpiry = expiries?.[0];
                    const proposalStatus = client.proposals?.[0]?.status;

                    // Calculate RAG status based on expiry
                    const today = new Date();
                    const daysUntil = nextExpiry ? Math.ceil((nextExpiry.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

                    let ragLabel = "Current";
                    let ragColor = "success";
                    
                    if (nextExpiry) {
                      if (daysUntil !== null) {
                        if (daysUntil < 0) { ragLabel = "Expired"; ragColor = "danger"; }
                        else if (daysUntil < 30) { ragLabel = "Expiring"; ragColor = "gold"; }
                      }
                    } else {
                      ragLabel = "Incomplete";
                      ragColor = "muted-foreground"; // We'll use a neutral color for missing docs
                    }

                    return (
                      <tr key={client.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer relative">
                        <td className="px-6 py-4">
                          <Link href={`/admin/clients/${client.id}`} className="absolute inset-0 z-0" />
                          <div className="flex items-start gap-4 relative z-10 pointer-events-none">
                            <span className="font-mono text-[10px] text-[#555] mt-1 w-10">CL-<br />{client.id.slice(0, 4).toUpperCase()}</span>
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
                          <div className={`inline-flex px-2.5 py-1 border border-${proposalStatus ? (proposalStatus === 'Signed' ? 'teal' : 'gold') : 'white'}/40 text-${proposalStatus ? (proposalStatus === 'Signed' ? 'teal' : 'gold') : 'white'}/60 text-[10px] font-mono uppercase tracking-wider rounded leading-none`}>
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
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden flex flex-col pb-4 animate-in-fade [animation-delay:0.3s]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/40">03</span>
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Reports awaiting review</h3>
                <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">{reviewQueue.length} Drafts</span>
              </div>
              <Link href="/admin/review-queue" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">View queue</Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-white/5 mt-2">
              {reviewQueue.map((item) => (
                <div key={item.id} className="p-6 flex flex-col gap-3 group relative">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} &middot; {new Date(item.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div>
                    <div className="font-medium text-white mb-1">{(item.client as { name?: string } | null)?.name}</div>
                    <div className="text-xs text-[#888] leading-relaxed">
                      {(item.template as { form_template?: { name?: string } | null } | null)?.form_template?.name}<br />
                      Draft assessment
                    </div>
                  </div>
                  <Link href={`/admin/assessments/${item.id}`}>
                    <Button variant="secondary" className="bg-white text-black text-xs font-medium w-fit mt-2 rounded-[2px] h-8 px-4">Review &rarr;</Button>
                  </Link>
                </div>
              ))}
              {reviewQueue.length === 0 && (
                <div className="col-span-3 py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
                  No reports awaiting review
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 02 UPCOMING EXPIRIES */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col h-full animate-in-fade [animation-delay:0.4s]">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-white/40">02</span>
              <h3 className="font-sans font-medium text-white tracking-wide text-lg">Upcoming expiries</h3>
            </div>
            <Link href="/admin/expiries" className="font-mono text-[10px] uppercase tracking-widest text-[#aaa] hover:text-white border-b border-[#aaa] pb-0.5">View all</Link>
          </div>

          <div className="flex flex-col gap-6">
            {upcomingExpiries.length > 0 ? (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="px-3 py-1 bg-white/5 border-l-2 border-danger/60 text-white/80 font-mono text-[10px] uppercase tracking-widest leading-none">Attention Required</div>
                  <div className="font-mono text-[10px] text-white/20 uppercase tracking-widest">{stats.totalExpiries} Items</div>
                </div>
                <div className="flex flex-col gap-5">
                  {upcomingExpiries.map((doc) => {
                    const daysLeft = Math.ceil((new Date(doc.expiry_date || "").getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={doc.id} className="flex justify-between items-start gap-4 border-b border-white/5 pb-5 last:border-0 last:pb-0">
                        <div>
                          <div className="text-white text-sm font-medium mb-1">{doc.filename}</div>
                          <div className="text-xs text-[#888]">{(doc.client as { name?: string } | null)?.name} <span className="font-mono ml-1 uppercase">{new Date(doc.expiry_date || "").toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                        </div>
                        {daysLeft < 0 ? (
                          <div className="inline-flex items-center px-2.5 py-1 text-danger border border-danger/40 text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-danger mr-1.5 animate-pulse"></div> OVERDUE
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-2.5 py-1 text-gold border border-gold/40 text-[10px] font-mono uppercase tracking-wider rounded-sm shrink-0 mt-0.5 leading-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-gold mr-1.5"></div> {daysLeft}d left
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
                No upcoming expiries
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ─── ROW 2: 04 COMPLIANCE + 06 PROPOSALS + 05 HOURS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 04 COMPLIANCE STATUS */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col h-[400px] animate-in-fade [animation-delay:0.5s]">
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-xs text-white/40">04</span>
            <h3 className="font-sans font-medium text-white tracking-wide text-lg">Compliance status</h3>
            <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">{compliance.total} Docs</span>
          </div>

          <ComplianceChart data={complianceData} />

          <div className="flex justify-center gap-6 mt-4 font-mono text-[10px] text-white/80">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-teal"></div> Current {compliance.current}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#d4a373]"></div> Expiring {compliance.expiring}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#e63946]"></div> Expired {compliance.expired}
            </div>
          </div>
        </Card>

        {/* 05 HOURS BALANCES */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden p-6 flex flex-col animate-in-fade [animation-delay:0.6s]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-white/40">05</span>
              <h3 className="font-sans font-medium text-white tracking-wide text-lg">Hours balances</h3>
            </div>
            <Link href="/admin/hours" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">See all</Link>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            {clients?.slice(0, 8).map((client) => {
              const balance = client.hours_balance || 0;
              const isDanger = balance < 3;
              const isWarning = balance < 10;
              const barColor = isDanger ? "bg-danger" : isWarning ? "bg-gold" : "bg-[#555]";
              const textColor = isDanger ? "text-danger" : isWarning ? "text-gold" : "text-white/50";
              const progressWidth = Math.min(100, (balance / 20) * 100);

              return (
                <div key={client.id} className="flex items-center text-xs">
                  <span className="w-1/3 truncate text-white/80">{client.name}</span>
                  <div className="flex-1 h-1.5 bg-[#222] rounded-full mx-3 overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${progressWidth}%` }}></div>
                  </div>
                  <span className={`font-mono ${textColor} w-8 text-right`}>{balance}h</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 items-center mt-auto text-[10px] font-mono text-[#555] pt-4">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-gold"></div> &lt;10h</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-danger"></div> &lt;3h</div>
          </div>
        </Card>

        {/* 06 ACTIVE PROPOSALS */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col animate-in-fade [animation-delay:0.7s]">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs text-white/40">06</span>
              <div>
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Active proposals</h3>
                <div className="font-mono text-[10px] text-[#666] uppercase tracking-widest mt-1.5 leading-relaxed">
                  In Pipeline
                </div>
              </div>
            </div>
            <Link href="/admin/proposals" className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white border-b border-white/20 pb-0.5">Open Pipeline</Link>
          </div>

          <div className="flex flex-col relative before:absolute before:left-3.5 before:top-4 before:bottom-6 before:w-[1px] before:bg-white/10 gap-8 ml-2">
            {['draft', 'sent', 'signed', 'contract_sent'].map((statusKey, idx) => {
              // Normalize status for matching (handle spaces, underscores, and casing)
              const count = allProposals?.filter(p => {
                const normalized = p.status.toLowerCase().replace(/ /g, '_');
                if (statusKey === 'contract_sent') {
                  return normalized === 'contract_sent' || normalized === 'contract_issued';
                }
                return normalized === statusKey;
              }).length || 0;

              return (
                <div key={statusKey} className="relative flex items-center gap-6">
                  <div className="w-7 h-7 rounded-full border border-white/20 bg-[#1c1c1c] flex items-center justify-center font-mono text-xs text-white z-10 shrink-0">{count}</div>
                  <div className="flex-1">
                    <div className="font-mono text-[10px] tracking-widest text-[#888] uppercase">{statusKey.replace('_', ' ')}</div>
                  </div>
                  <span className="text-white/20 font-mono text-sm">&gt;</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ─── ROW 3: 07 WORKFLOW ERRORS (Left) & 08 THIS MONTH (Right) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        {/* 07 WORKFLOW ERRORS */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col animate-in-fade [animation-delay:0.8s]">
          <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-white/40">07</span>
              <h3 className="font-sans font-medium text-white tracking-wide text-lg">Workflow errors</h3>
              <span className={`font-mono text-[10px] ${stats.errorCount > 0 ? 'text-danger' : 'text-success'} border border-current/20 rounded-full text-[9px] font-mono uppercase tracking-widest ml-3 bg-white/5 px-2.5 py-1 leading-none`}>
                {stats.errorCount} {stats.errorCount === 1 ? 'Failing' : 'Failing'}
              </span>
            </div>
            <Link href="/admin/errors" className="font-mono text-[10px] uppercase tracking-widest text-[#aaa] hover:text-white inline-flex items-center gap-1 px-3 py-1 border border-white/15 rounded-[2px] hover:bg-white/5 transition-colors">View Log &rarr;</Link>
          </div>

          <div className="flex flex-col text-xs divide-y divide-white/5">
            {recentErrors.map((error) => {
              const friendly = describeWorkflowError(error.workflow_name);
              const who = error.details.find((d) => d.label === "Client")?.value;
              return (
                <div key={error.id} className="flex items-start md:items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="w-24 shrink-0 text-[#666] font-mono">
                    {Math.floor((Date.now() - new Date(error.created_at).getTime()) / (1000 * 60 * 60))} h ago
                  </span>
                  <div className="w-12 shrink-0 px-2 py-0.5 border border-danger/20 rounded-[2px] text-danger text-[10px] text-center font-bold font-mono">ERR</div>
                  <span className="flex-1 truncate text-white/90 font-sans">
                    {friendly.title}
                    {who && <span className="text-white/40 ml-2">— {who}</span>}
                  </span>
                </div>
              );
            })}
            {recentErrors.length === 0 && (
              <div className="py-8 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
                No active workflow errors
              </div>
            )}
          </div>
        </Card>

        {/* 08 THIS MONTH */}
        <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col animate-in-fade [animation-delay:0.9s]">
          <div className="flex items-center gap-3 mb-8">
            <span className="font-mono text-xs text-white/40">08</span>
            <h3 className="font-sans font-medium text-white tracking-wide text-lg whitespace-nowrap">This month</h3>
            <span className="font-mono text-[10px] text-white/50 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest ml-3 bg-white/5 px-2.5 py-1 leading-none">
              {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-10 gap-x-6">
            <div>
              <div className="font-serif text-3xl text-white mb-2">12</div>
              <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Assessments<br />completed</div>
            </div>
            <div>
              <div className="font-serif text-3xl text-white mb-2">9</div>
              <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Reports<br />delivered</div>
            </div>
            <div>
              <div className="font-serif text-3xl text-white mb-2">{clients?.reduce((acc, c) => acc + (c.hours_balance || 0), 0).toFixed(0)}</div>
              <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Current Total<br />Hours</div>
            </div>
            <div>
              <div className="font-serif text-3xl text-white mb-2">3</div>
              <div className="font-mono text-[10px] uppercase text-[#666] tracking-widest leading-relaxed">Proposals<br />signed</div>
            </div>
          </div>

          <Link href="/admin/month-summary" className="mt-8 self-start font-mono text-[10px] uppercase tracking-widest text-[#aaa] hover:text-white border-b border-[#aaa] pb-0.5">
            View full summary &rarr;
          </Link>
        </Card>
      </div>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ComplianceChart } from "./compliance-chart";
import { ClientRow } from "./clients/_components/client-row";
import { ragToneFromDays } from "@/lib/ui/rag-tone";
import { describeWorkflowError } from "@/lib/workflow-errors";
import {
  daysUntilExpiry,
  todayIsoInTimeZone,
} from "@/lib/compliance/expiry-status";
import {
  getDashboardStats,
  getReportsAwaitingReview,
  getUpcomingExpiries,
  getComplianceAggregates,
  getComplianceBreakdown,
  getWorkflowErrors,
  getMonthlyHeadline
} from "@/lib/supabase/dashboard";

export const dynamic = "force-dynamic";

function formatWorkflowTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch live dashboard metrics — all queries are independent, run in parallel
  const [stats, reviewQueue, upcomingExpiries, compliance, complianceBreakdown, recentErrors, monthly, clientsRes, allProposalsRes] = await Promise.all([
    getDashboardStats(),
    getReportsAwaitingReview(),
    getUpcomingExpiries(6),
    getComplianceAggregates(),
    getComplianceBreakdown(),
    getWorkflowErrors(),
    getMonthlyHeadline(),
    supabase
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
      .is("deleted_at", null)
      .eq("documents.active", true)
      .is("documents.deleted_at", null)
      .order("name", { ascending: true })
      .limit(50),
    supabase
      .from("proposals")
      .select("status"),
  ]);

  const MOCK_CLIENTS = [
    {
      id: "demo-client-1",
      name: "Grand Horizon Hotel",
      hours_balance: 48,
      documents: [
        { expiry_date: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10), document_category: "Fire Risk Assessment", filename: "FRA_2026_GrandHorizon.pdf" }
      ],
      proposals: [{ status: "signed" }]
    },
    {
      id: "demo-client-2",
      name: "Metro West Office Park",
      hours_balance: 24,
      documents: [
        { expiry_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10), document_category: "Emergency Lighting", filename: "Emergency_Lighting_Cert.pdf" }
      ],
      proposals: [{ status: "sent" }]
    },
    {
      id: "demo-client-3",
      name: "Riverside Logistics Center",
      hours_balance: 8,
      documents: [
        { expiry_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), document_category: "Extinguisher Inspection", filename: "Extinguisher_Log_2025.pdf" }
      ],
      proposals: [{ status: "draft" }]
    },
    {
      id: "demo-client-4",
      name: "Oakridge Academy",
      hours_balance: 60,
      documents: [
        { expiry_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), document_category: "Fire Alarm Testing", filename: "Alarm_System_Certificate.pdf" }
      ],
      proposals: [{ status: "signed" }]
    },
    {
      id: "demo-client-5",
      name: "Vanguard Innovation Hub",
      hours_balance: 32,
      documents: [
        { expiry_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10), document_category: "Evacuation Plan", filename: "Evac_Procedure_2026.pdf" }
      ],
      proposals: [{ status: "contract_sent" }]
    }
  ];

  const clients = (clientsRes.data && clientsRes.data.length > 0) ? clientsRes.data : MOCK_CLIENTS;
  const allProposals = (allProposalsRes.data && allProposalsRes.data.length > 0) ? allProposalsRes.data : [
    { status: "draft" },
    { status: "sent" },
    { status: "signed" },
    { status: "signed" },
    { status: "contract_sent" }
  ];
  const todayIso = todayIsoInTimeZone();

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
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-teal font-semibold">01</span>
            SINGLE PANE OF GLASS
          </div>
          <h2 className="font-serif text-[26px] md:text-[30px] leading-tight text-muted-foreground">
            <span className="text-foreground">Welcome back, Alex.</span> {stats.totalItemsNeeded} {stats.totalItemsNeeded === 1 ? 'item needs' : 'items need'} you today.
          </h2>
        </div>

        <div className="flex gap-6 lg:gap-8 text-right shrink-0">
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Drafts to review</div>
            <div className="font-serif text-3xl text-gold">{stats.reviewCount}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Overdue docs</div>
            <div className="font-serif text-3xl text-danger">{stats.overdueCount}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Expiring (30d)</div>
            <div className="font-serif text-3xl text-gold">{stats.expiringCount}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">Workflow errors</div>
            <div className="font-serif text-3xl text-danger">{stats.errorCount}</div>
          </div>
        </div>
      </div>

      {/* ─── ROW 1: 01 CLIENTS + 04 REPORTS (Left) & 02 UPCOMING (Right) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          {/* 01 CLIENTS */}
          <Card className="bg-card border-border rounded-sm overflow-hidden flex flex-col max-h-[420px] animate-in-fade [animation-delay:0.2s]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">01</span>
                <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Clients</h3>
                <span className="px-2.5 py-1 bg-muted border border-border rounded-full text-[9px] font-mono uppercase tracking-widest text-muted-foreground ml-3 leading-none">{clients?.length || 0} Active</span>
              </div>
              <Link href="/admin/clients" className="font-mono text-[10px] uppercase tracking-widest text-foreground/70 hover:text-foreground underline underline-offset-4 decoration-foreground/20">
                View all
              </Link>
            </div>

            <div className="w-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              <table className="w-full table-fixed text-left font-sans text-sm">
                <thead className="bg-muted">
                  <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                    <th className="font-normal px-6 py-3 border-b border-border text-left w-[34%]">Client</th>
                    <th className="font-normal px-4 py-3 border-b border-border text-center w-[15%]">Rag</th>
                    <th className="font-normal px-4 py-3 border-b border-border text-center w-[9%]">Credits</th>
                    <th className="font-normal px-4 py-3 border-b border-border text-left w-[19%]">Next Expiry</th>
                    <th className="font-normal px-4 py-3 border-b border-border text-center w-[14%]">Proposal</th>
                    <th className="font-normal px-4 py-3 border-b border-border text-center w-[9%]">Docs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients?.map((client) => {
                    // Calculate next expiry
                    type DocRow = { expiry_date: string | null; document_category: string | null };
                    const expiries = (client.documents as DocRow[] | null)
                      ?.map((d) => ({
                        iso: d.expiry_date,
                        date: new Date(d.expiry_date ?? ""),
                        cat: d.document_category,
                      }))
                      .filter((d) => !isNaN(d.date.getTime()))
                      .sort((a, b) => a.date.getTime() - b.date.getTime());

                    const nextExpiry = expiries?.[0];
                    const proposalStatus = client.proposals?.[0]?.status;

                    // Calculate RAG status based on expiry
                    const daysUntil = nextExpiry?.iso
                      ? daysUntilExpiry(nextExpiry.iso, todayIso)
                      : null;

                    // Shared tone → class mapping (lib/ui/rag-tone.ts). Both
                    // producers previously open-coded this and disagreed on the
                    // neutral "no documents" token.
                    const ragTone = ragToneFromDays(daysUntil);
                    const ragLabel = !nextExpiry
                      ? "Incomplete"
                      : ragTone === "expired"
                        ? "Expired"
                        : ragTone === "expiring"
                          ? "Expiring"
                          : "Current";

                    // Same fully-clickable row as /admin/clients (BUG 5 fix) —
                    // replaces the `absolute inset-0` overlay <Link>, whose
                    // stacking against the static cells made most of the row
                    // dead to real pointer clicks.
                    return (
                      <ClientRow
                        key={client.id}
                        id={client.id}
                        name={client.name}
                        hoursBalance={client.hours_balance}
                        ragLabel={ragLabel}
                        ragTone={ragTone}
                        nextExpiryLabel={nextExpiry ? nextExpiry.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}
                        nextExpiryCategory={nextExpiry?.cat || "No upcoming"}
                        proposalStatus={proposalStatus || null}
                        docCount={client.documents?.length || 0}
                        activeCount={0}
                      />
                    );
                  })}
                  {!clients || clients.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground/50 font-mono text-xs uppercase tracking-widest">
                        No clients found in database
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* 03 REPORTS AWAITING REVIEW */}
          <Card className="bg-card border-border rounded-sm overflow-hidden flex flex-col pb-4 animate-in-fade [animation-delay:0.3s]">
            <div className="px-6 py-4 flex justify-between items-center border-b border-border">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">03</span>
                <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Reports awaiting review</h3>
                <span className="px-2.5 py-1 bg-muted border border-border rounded-full text-[9px] font-mono uppercase tracking-widest text-muted-foreground ml-3 leading-none">{reviewQueue.length} Drafts</span>
              </div>
              <Link href="/admin/review-queue" className="font-mono text-[10px] uppercase tracking-widest text-foreground/70 hover:text-foreground underline underline-offset-4 decoration-foreground/20">View queue</Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-x divide-border mt-2">
              {reviewQueue.map((item) => (
                <div key={item.id} className="p-6 flex flex-col gap-3 group relative">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} &middot; {new Date(item.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div>
                    <div className="font-medium text-foreground mb-1">{(item.client as { name?: string } | null)?.name}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {(item.template as { form_template?: { name?: string } | null } | null)?.form_template?.name}<br />
                      Draft assessment
                    </div>
                  </div>
                  <Link href={`/admin/assessments/${item.id}`}>
                    <Button variant="secondary" className="bg-primary text-primary-foreground text-xs font-medium w-fit mt-2 rounded-[2px] h-8 px-4">Review &rarr;</Button>
                  </Link>
                </div>
              ))}
              {reviewQueue.length === 0 && (
                <div className="col-span-3 py-12 text-center text-muted-foreground/50 font-mono text-xs uppercase tracking-widest">
                  No reports awaiting review
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 02 UPCOMING EXPIRIES */}
        <Card className="bg-card border-border rounded-sm p-6 flex flex-col h-full animate-in-fade [animation-delay:0.4s]">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">02</span>
              <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Upcoming expiries</h3>
            </div>
            <Link href="/admin/expiries" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground border-b border-muted-foreground pb-0.5">View all</Link>
          </div>

          <div className="flex flex-col gap-6">
            {upcomingExpiries.length > 0 ? (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="px-3 py-1 bg-muted border-l-2 border-danger/60 text-foreground/80 font-mono text-[10px] uppercase tracking-widest leading-none">Attention Required</div>
                  <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">{stats.totalExpiries} Items</div>
                </div>
                <div className="flex flex-col gap-5">
                  {upcomingExpiries.map((doc) => {
                    const daysLeft = daysUntilExpiry(
                      doc.expiry_date as string,
                      todayIso
                    );
                    return (
                      <div key={doc.id} className="flex justify-between items-start gap-4 border-b border-border pb-5 last:border-0 last:pb-0">
                        <div>
                          <div className="text-foreground text-sm font-medium mb-1">{doc.filename}</div>
                          <div className="text-xs text-muted-foreground">{(doc.client as { name?: string } | null)?.name} <span className="font-mono ml-1 uppercase">{new Date(doc.expiry_date || "").toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                        </div>
                        {daysLeft <= 0 ? (
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
              <div className="py-12 text-center text-muted-foreground/50 font-mono text-xs uppercase tracking-widest">
                No upcoming expiries
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ─── ROW 2: 04 COMPLIANCE + 06 PROPOSALS + 05 HOURS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 04 COMPLIANCE STATUS */}
        {/* overflow-visible + z-10: the compliance breakdown panel drops below the
            card and must paint over later sibling cards (each card's retained
            fade-in animation makes it a stacking context) */}
        <Card className="bg-card border-border rounded-sm p-6 flex flex-col h-[400px] overflow-visible relative z-10 animate-in-fade [animation-delay:0.5s]">
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-xs text-muted-foreground">04</span>
            <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Compliance status</h3>
            <span className="px-2.5 py-1 bg-muted border border-border rounded-full text-[9px] font-mono uppercase tracking-widest text-muted-foreground ml-3 leading-none">{compliance.total} Docs</span>
          </div>

          <ComplianceChart data={complianceData} breakdown={complianceBreakdown} />
        </Card>

        {/* 05 HOURS BALANCES */}
        <Card className="bg-card border-border rounded-sm overflow-hidden p-6 flex flex-col animate-in-fade [animation-delay:0.6s]">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">05</span>
              <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Credit balances</h3>
            </div>
            <Link href="/admin/hours" className="font-mono text-[10px] uppercase tracking-widest text-foreground/70 hover:text-foreground underline underline-offset-4 decoration-foreground/20">See all</Link>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            {clients?.slice(0, 8).map((client) => {
              const balance = client.hours_balance || 0;
              const isDanger = balance < 12;
              const isWarning = balance < 40;
              const barColor = isDanger ? "bg-danger" : isWarning ? "bg-gold" : "bg-muted-foreground";
              const textColor = isDanger ? "text-danger" : isWarning ? "text-gold" : "text-muted-foreground";
              const progressWidth = Math.min(100, (balance / 80) * 100);

              return (
                <div key={client.id} className="flex items-center text-xs">
                  <span className="w-1/3 truncate text-foreground/80">{client.name}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full mx-3 overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${progressWidth}%` }}></div>
                  </div>
                  <span className={`font-mono ${textColor} w-8 text-right`}>{balance}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 items-center mt-auto text-[10px] font-mono text-muted-foreground pt-4">
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-gold"></div> &lt;40</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-danger"></div> &lt;12</div>
          </div>
        </Card>

        {/* 06 ACTIVE PROPOSALS */}
        <Card className="bg-card border-border rounded-sm p-6 flex flex-col animate-in-fade [animation-delay:0.7s]">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs text-muted-foreground">06</span>
              <div>
                <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Active proposals</h3>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-1.5 leading-relaxed">
                  In Pipeline
                </div>
              </div>
            </div>
            <Link href="/admin/proposals" className="font-mono text-[10px] uppercase tracking-widest text-foreground/70 hover:text-foreground border-b border-foreground/20 pb-0.5">Open Pipeline</Link>
          </div>

          <div className="flex flex-col relative before:absolute before:left-3.5 before:top-4 before:bottom-6 before:w-[1px] before:bg-border gap-8 ml-2">
            {['draft', 'sent', 'signed', 'contract_sent'].map((statusKey) => {
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
                  <div className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center font-mono text-xs text-foreground z-10 shrink-0">{count}</div>
                  <div className="flex-1">
                    <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{statusKey.replace('_', ' ')}</div>
                  </div>
                  <span className="text-muted-foreground/50 font-mono text-sm">&gt;</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ─── ROW 3: 07 WORKFLOW ERRORS (Left) & 08 THIS MONTH (Right) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        {/* 07 WORKFLOW ERRORS */}
        <Card className="bg-card border-border rounded-sm p-6 flex flex-col animate-in-fade [animation-delay:0.8s]">
          <div className="flex justify-between items-start mb-6 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">07</span>
              <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Workflow errors</h3>
              <span className={`font-mono text-[10px] ${stats.errorCount > 0 ? 'text-danger' : 'text-success'} border border-current/20 rounded-full text-[9px] font-mono uppercase tracking-widest ml-3 bg-muted px-2.5 py-1 leading-none`}>
                {stats.errorCount} {stats.errorCount === 1 ? 'Failing' : 'Failing'}
              </span>
            </div>
            <Link href="/admin/errors" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-3 py-1 border border-border rounded-[2px] hover:bg-muted transition-colors">View Log &rarr;</Link>
          </div>

          <div className="flex flex-col text-xs divide-y divide-border">
            {recentErrors.map((error) => {
              const friendly = describeWorkflowError(error.workflow_name);
              const who = error.details.find((d) => d.label === "Client")?.value;
              return (
                <div key={error.id} className="flex items-start md:items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="w-24 shrink-0 text-muted-foreground font-mono">
                    {formatWorkflowTimestamp(error.created_at)}
                  </span>
                  <div className="w-12 shrink-0 px-2 py-0.5 border border-danger/20 rounded-[2px] text-danger text-[10px] text-center font-bold font-mono">ERR</div>
                  <span className="flex-1 truncate text-foreground/90 font-sans">
                    {friendly.title}
                    {who && <span className="text-muted-foreground ml-2">— {who}</span>}
                  </span>
                </div>
              );
            })}
            {recentErrors.length === 0 && (
              <div className="py-8 text-center text-muted-foreground/50 font-mono text-xs uppercase tracking-widest">
                No active workflow errors
              </div>
            )}
          </div>
        </Card>

        {/* 08 THIS MONTH */}
        <Card className="bg-card border-border rounded-sm p-6 flex flex-col animate-in-fade [animation-delay:0.9s]">
          <div className="flex items-center gap-3 mb-8">
            <span className="font-mono text-xs text-muted-foreground">08</span>
            <h3 className="font-sans font-medium text-foreground tracking-wide text-lg whitespace-nowrap">This month</h3>
            <span className="font-mono text-[10px] text-muted-foreground border border-border rounded-full text-[9px] font-mono uppercase tracking-widest ml-3 bg-muted px-2.5 py-1 leading-none">
              {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-10 gap-x-6">
            <div>
              <div className="font-serif text-3xl text-foreground mb-2">{monthly.assessmentsCompleted}</div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest leading-relaxed">Assessments<br />completed</div>
            </div>
            <div>
              <div className="font-serif text-3xl text-foreground mb-2">{monthly.reportsDelivered}</div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest leading-relaxed">Reports<br />delivered</div>
            </div>
            <div>
              <div className="font-serif text-3xl text-foreground mb-2">{clients?.reduce((acc, c) => acc + (c.hours_balance || 0), 0).toFixed(0)}</div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest leading-relaxed">Current Total<br />Credits</div>
            </div>
            <div>
              <div className="font-serif text-3xl text-foreground mb-2">{monthly.proposalsSigned}</div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest leading-relaxed">Proposals<br />signed</div>
            </div>
          </div>

          <Link href="/admin/month-summary" className="mt-8 self-start font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground border-b border-muted-foreground pb-0.5">
            View full summary &rarr;
          </Link>
        </Card>
      </div>
    </div>
  );
}

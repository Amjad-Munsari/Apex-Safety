"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { FileText, ClipboardCheck, FileSignature, Clock, ShieldCheck } from "lucide-react"
import Link from "next/link"

type RagStatus = "CURRENT" | "EXPIRING" | "EXPIRED"

interface DocumentRow {
  id: string
  filename: string
  document_category: string
  expiry_date: string | null
  uploaded_at: string
}

interface ProposalRow {
  id: string
  status: string | null
  created_at: string
  total: number
  pdfUrl: string | null
}

export interface ClientTabsProps {
  clientId: string
  clientName: string
  hoursBalance: number
  documents: DocumentRow[]
  proposals: ProposalRow[]
}

function ragFromDate(expiry: string | null): RagStatus {
  if (!expiry) return "CURRENT"
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return "EXPIRED"
  if (days <= 30) return "EXPIRING"
  return "CURRENT"
}

function ragTone(status: RagStatus) {
  switch (status) {
    case "EXPIRED":
      return { ring: "ring-danger/40", text: "text-danger", dot: "bg-danger" }
    case "EXPIRING":
      return { ring: "ring-gold/40", text: "text-gold", dot: "bg-gold" }
    default:
      return { ring: "ring-success/40", text: "text-success", dot: "bg-success" }
  }
}

function RagPill({ status }: { status: RagStatus }) {
  const tone = ragTone(status)
  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ring-1 ${tone.ring} ${tone.text} font-mono text-[10px] uppercase tracking-widest leading-none`}>
      <span className={`size-1.5 rounded-full ${tone.dot}`} />
      {status}
    </span>
  )
}

// Deterministic mock generator so each client gets stable demo data without a DB column.
function mockSeedFor(clientId: string): number {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) {
    hash = (hash * 31 + clientId.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash)
}

const BUSINESS_TYPES = [
  "Care Home",
  "Hospitality",
  "Commercial Office",
  "Education",
  "Retail",
  "Healthcare",
]

const FIRST_NAMES = ["Sarah", "James", "Priya", "Ahmed", "Olivia", "Michael", "Hannah", "David"]
const LAST_NAMES = ["Whitfield", "Thornton", "Patel", "Ali", "Reynolds", "Bennett", "Clarke", "Hughes"]

function mockContactFor(clientId: string, clientName: string) {
  const seed = mockSeedFor(clientId)
  const first = FIRST_NAMES[seed % FIRST_NAMES.length]
  const last = LAST_NAMES[(seed >> 4) % LAST_NAMES.length]
  const business = BUSINESS_TYPES[(seed >> 8) % BUSINESS_TYPES.length]
  const slug = clientName.toLowerCase().replace(/[^a-z]+/g, "") || "client"
  const phoneLast = 100000 + (seed % 900000)
  return {
    contactName: `${first} ${last}`,
    contactEmail: `${first.toLowerCase()}.${last.toLowerCase()}@${slug}.co.uk`,
    contactPhone: `+44 20 ${String(phoneLast).slice(0, 4)} ${String(phoneLast).slice(4)}`,
    businessType: business,
  }
}

interface ComplianceItem {
  id: string
  title: string
  category: string
  expiry: string | null
  status: RagStatus
}

function buildComplianceFromDocuments(documents: DocumentRow[], clientId: string): Record<string, ComplianceItem[]> {
  const groups: Record<string, ComplianceItem[]> = {}
  for (const doc of documents) {
    const cat = (doc.document_category || "Uncategorised").toUpperCase()
    if (!groups[cat]) groups[cat] = []
    groups[cat].push({
      id: doc.id,
      title: doc.filename,
      category: cat,
      expiry: doc.expiry_date,
      status: ragFromDate(doc.expiry_date),
    })
  }

  // Top up with deterministic mocks so every client demos the grouped pattern.
  if (Object.keys(groups).length === 0) {
    const seed = mockSeedFor(clientId)
    const mocks: ComplianceItem[] = [
      { id: "m-1", title: "Fire Risk Assessment (Type 3)", category: "FIRE SAFETY", expiry: addDays(seed % 60), status: "EXPIRING" },
      { id: "m-2", title: "Fire Extinguisher Service Certificate", category: "FIRE SAFETY", expiry: addDays(180), status: "CURRENT" },
      { id: "m-3", title: "Emergency Lighting Test Certificate", category: "FIRE SAFETY", expiry: addDays(120), status: "CURRENT" },
      { id: "m-4", title: "EICR — Electrical Installation Condition Report", category: "ELECTRICAL", expiry: addDays(-15), status: "EXPIRED" },
      { id: "m-5", title: "PAT Testing Certificate — 42 items", category: "ELECTRICAL", expiry: addDays(300), status: "CURRENT" },
      { id: "m-6", title: "Legionella Risk Assessment", category: "WATER HYGIENE", expiry: addDays(45), status: "EXPIRING" },
      { id: "m-7", title: "First Aid at Work — 3 staff", category: "TRAINING", expiry: addDays(420), status: "CURRENT" },
    ]
    for (const m of mocks) {
      if (!groups[m.category]) groups[m.category] = []
      groups[m.category].push(m)
    }
  }
  return groups
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

interface AssessmentRow {
  id: string
  date: string
  type: string
  status: "Delivered" | "Draft" | "In review"
  reportHref: string
}

function mockAssessmentsFor(clientId: string): AssessmentRow[] {
  const seed = mockSeedFor(clientId)
  const types = ["Fire Risk Assessment (Type 3)", "Quarterly Site Risk Audit", "Annual Safety Review", "Fire Door Inspection"]
  const statuses: AssessmentRow["status"][] = ["Delivered", "Delivered", "In review", "Draft"]
  return Array.from({ length: 4 }).map((_, i) => ({
    id: `ASMT-${(seed % 9000) + 1000 + i}`,
    date: addDays(-(20 + ((seed >> i) % 200))),
    type: types[(seed + i) % types.length],
    status: statuses[i],
    reportHref: `/admin/assessments/${clientId}-${i}`,
  }))
}

interface HoursTxn {
  id: string
  date: string
  description: string
  delta: number
  balance: number
}

function mockHoursLog(clientId: string, currentBalance: number): HoursTxn[] {
  const seed = mockSeedFor(clientId)
  const entries: Array<{ description: string; delta: number; daysAgo: number }> = [
    { description: "Initial retainer purchase", delta: 20, daysAgo: 180 },
    { description: "FRA — Type 3 site visit", delta: -8, daysAgo: 150 },
    { description: "Quarterly review", delta: -2, daysAgo: 90 },
    { description: "Top-up — block of hours", delta: 10, daysAgo: 60 },
    { description: "Fire door inspection", delta: -3, daysAgo: 30 },
    { description: "Compliance phone consult", delta: -1, daysAgo: 7 },
  ]
  // Reconcile final balance to currentBalance by adjusting the latest top-up
  let running = 0
  const log: HoursTxn[] = []
  entries.forEach((e, i) => {
    running += e.delta
    log.push({
      id: `TXN-${(seed % 9000) + i}`,
      date: addDays(-e.daysAgo),
      description: e.description,
      delta: e.delta,
      balance: running,
    })
  })
  // If final running != currentBalance, append a reconciliation entry today.
  if (running !== currentBalance) {
    const diff = currentBalance - running
    log.push({
      id: `TXN-${(seed % 9000) + 99}`,
      date: new Date().toISOString(),
      description: diff >= 0 ? "Adjustment — added hours" : "Adjustment — used hours",
      delta: diff,
      balance: currentBalance,
    })
  }
  // Newest first
  return log.reverse()
}

export function ClientTabs({
  clientId,
  clientName,
  hoursBalance,
  documents,
  proposals,
}: ClientTabsProps) {
  const contact = mockContactFor(clientId, clientName)
  const compliance = buildComplianceFromDocuments(documents, clientId)
  const assessments = mockAssessmentsFor(clientId)
  const hoursLog = mockHoursLog(clientId, hoursBalance)

  return (
    <div className="flex flex-col gap-6">
      {/* Contact info row */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Contact</span>
            <span className="text-white text-sm">{contact.contactName}</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Email</span>
            <a href={`mailto:${contact.contactEmail}`} className="text-white text-sm hover:text-gold transition-colors break-all">
              {contact.contactEmail}
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Phone</span>
            <span className="text-white text-sm">{contact.contactPhone}</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Business type</span>
            <span className="text-white text-sm">{contact.businessType}</span>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList variant="line" className="border-b border-white/5 w-full justify-start rounded-none bg-transparent gap-6 px-0 h-auto py-0">
          <TabsTrigger value="documents" className="font-mono text-[10px] uppercase tracking-widest gap-2 px-1 pb-3 pt-0 data-active:text-white text-white/40">
            <FileText className="w-3.5 h-3.5" /> Documents <span className="text-white/30">{documents.length}</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="font-mono text-[10px] uppercase tracking-widest gap-2 px-1 pb-3 pt-0 data-active:text-white text-white/40">
            <ShieldCheck className="w-3.5 h-3.5" /> Compliance
          </TabsTrigger>
          <TabsTrigger value="assessments" className="font-mono text-[10px] uppercase tracking-widest gap-2 px-1 pb-3 pt-0 data-active:text-white text-white/40">
            <ClipboardCheck className="w-3.5 h-3.5" /> Assessments <span className="text-white/30">{assessments.length}</span>
          </TabsTrigger>
          <TabsTrigger value="proposals" className="font-mono text-[10px] uppercase tracking-widest gap-2 px-1 pb-3 pt-0 data-active:text-white text-white/40">
            <FileSignature className="w-3.5 h-3.5" /> Proposals <span className="text-white/30">{proposals.length}</span>
          </TabsTrigger>
          <TabsTrigger value="hours" className="font-mono text-[10px] uppercase tracking-widest gap-2 px-1 pb-3 pt-0 data-active:text-white text-white/40">
            <Clock className="w-3.5 h-3.5" /> Hours log
          </TabsTrigger>
        </TabsList>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="pt-6">
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-white/40" />
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Documents</h3>
                <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">
                  {documents.length} files
                </span>
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              {documents.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center">
                  <FileText className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-white/50 text-sm">No documents uploaded yet.</p>
                </div>
              ) : (
                <table className="w-full text-left font-sans text-sm">
                  <thead className="bg-[#151515]">
                    <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                      <th className="font-normal px-6 py-3 border-b border-white/5">Filename</th>
                      <th className="font-normal px-4 py-3 border-b border-white/5">Category</th>
                      <th className="font-normal px-4 py-3 border-b border-white/5">Expiry</th>
                      <th className="font-normal px-4 py-3 border-b border-white/5">Status</th>
                      <th className="font-normal px-6 py-3 border-b border-white/5 text-right">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {documents.map((doc) => {
                      const status = ragFromDate(doc.expiry_date)
                      return (
                        <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 text-white">{doc.filename}</td>
                          <td className="px-4 py-4 text-white/70">{doc.document_category}</td>
                          <td className="px-4 py-4 text-white/70">
                            {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString("en-GB") : "—"}
                          </td>
                          <td className="px-4 py-4"><RagPill status={status} /></td>
                          <td className="px-6 py-4 font-mono text-xs text-right text-white/50">
                            {new Date(doc.uploaded_at).toLocaleDateString("en-GB")}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* COMPLIANCE — grouped */}
        <TabsContent value="compliance" className="pt-6">
          <div className="flex flex-col gap-10">
            {Object.entries(compliance).map(([category, items]) => (
              <section key={category} className="flex flex-col gap-4">
                <div className="flex items-baseline gap-3 px-1">
                  <h3 className="font-mono text-[10px] tracking-widest text-white/60 uppercase">{category}</h3>
                  <span className="font-mono text-[10px] text-white/30 lowercase">{items.length} item{items.length === 1 ? "" : "s"}</span>
                </div>
                <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {items.map((item) => (
                      <div key={item.id} className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{item.title}</div>
                          <div className="font-mono text-[10px] text-white/30 uppercase tracking-widest mt-1">
                            {item.expiry ? `Expires ${new Date(item.expiry).toLocaleDateString("en-GB")}` : "No expiry"}
                          </div>
                        </div>
                        <RagPill status={item.status} />
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ))}
          </div>
        </TabsContent>

        {/* ASSESSMENTS */}
        <TabsContent value="assessments" className="pt-6">
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
            <table className="w-full text-left font-sans text-sm">
              <thead className="bg-[#151515]">
                <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                  <th className="font-normal px-6 py-3 border-b border-white/5">Reference</th>
                  <th className="font-normal px-4 py-3 border-b border-white/5">Date</th>
                  <th className="font-normal px-4 py-3 border-b border-white/5">Type</th>
                  <th className="font-normal px-4 py-3 border-b border-white/5">Status</th>
                  <th className="font-normal px-6 py-3 border-b border-white/5 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-white/60">{a.id}</td>
                    <td className="px-4 py-4 text-white/80">
                      {new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-4 text-white">{a.type}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full ring-1 font-mono text-[10px] uppercase tracking-widest leading-none
                        ${a.status === "Delivered" ? "ring-success/40 text-success" :
                          a.status === "In review" ? "ring-gold/40 text-gold" :
                          "ring-white/15 text-white/60"}`}>
                        <span className={`size-1.5 rounded-full ${
                          a.status === "Delivered" ? "bg-success" :
                          a.status === "In review" ? "bg-gold" :
                          "bg-white/40"
                        }`} />
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={a.reportHref} className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">
                        View report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* PROPOSALS */}
        <TabsContent value="proposals" className="pt-6">
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
            {proposals.length === 0 ? (
              <div className="p-10 text-center text-white/50 text-sm">No proposals generated yet.</div>
            ) : (
              <table className="w-full text-left font-sans text-sm">
                <thead className="bg-[#151515]">
                  <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                    <th className="font-normal px-6 py-3 border-b border-white/5">Date</th>
                    <th className="font-normal px-4 py-3 border-b border-white/5">Status</th>
                    <th className="font-normal px-4 py-3 border-b border-white/5 text-right">Amount</th>
                    <th className="font-normal px-6 py-3 border-b border-white/5 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {proposals.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-white/80">
                        {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full ring-1 ring-white/15 text-white/70 font-mono text-[10px] uppercase tracking-widest leading-none">
                          {p.status || "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-right text-white">
                        £{p.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/proposals/${p.id}`} className="font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white underline underline-offset-4 decoration-white/20">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        {/* HOURS LOG */}
        <TabsContent value="hours" className="pt-6">
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-white/40" />
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Hours transactions</h3>
              </div>
              <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
                Current balance:&nbsp;
                <span className="text-white font-serif text-base">{hoursBalance}h</span>
              </div>
            </div>
            <table className="w-full text-left font-sans text-sm">
              <thead className="bg-[#151515]">
                <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
                  <th className="font-normal px-6 py-3 border-b border-white/5">Date</th>
                  <th className="font-normal px-4 py-3 border-b border-white/5">Description</th>
                  <th className="font-normal px-4 py-3 border-b border-white/5 text-right">Change</th>
                  <th className="font-normal px-6 py-3 border-b border-white/5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {hoursLog.map((txn) => (
                  <tr key={txn.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-white/80">
                      {new Date(txn.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-4 text-white">{txn.description}</td>
                    <td className={`px-4 py-4 font-mono text-xs text-right ${txn.delta >= 0 ? "text-success" : "text-danger"}`}>
                      {txn.delta >= 0 ? "+" : ""}{txn.delta}h
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-right text-white">{txn.balance}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

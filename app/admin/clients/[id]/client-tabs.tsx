"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { FileText, ClipboardCheck, FileSignature, Clock, ShieldCheck, ClipboardList } from "lucide-react"
import Link from "next/link"
import { AssignTemplateModal } from "@/components/admin/assign-template-modal"
import { RevokeAssignmentButton } from "@/app/admin/assignments/revoke-assignment-button"
import { daysOverdue } from "@/lib/assignments/is-overdue"

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

export interface AssessmentRow {
  id: string
  date: string
  type: string
  status: "Delivered" | "Draft" | "In review"
  reportHref: string
}

export interface HoursTxn {
  id: string
  date: string
  description: string
  delta: number
  balance: number
}

export interface AssignmentRow {
  id: string
  status: string
  due_date: string | null
  instructions: string | null
  created_at: string
  template_version_id: string | null
  template: { id: string; name: string } | null
}

export interface ClientTabsProps {
  clientId: string
  clientName: string
  hoursBalance: number
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  documents: DocumentRow[]
  proposals: ProposalRow[]
  assessments: AssessmentRow[]
  hoursLog: HoursTxn[]
  /** Assignments for this client — filtered by deleted_at IS NULL. */
  assignments?: AssignmentRow[]
  /** Published templates — for the Assign template modal. */
  publishedTemplates?: Array<{ id: string; name: string }>
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

interface ComplianceItem {
  id: string
  title: string
  category: string
  expiry: string | null
  status: RagStatus
}

function buildComplianceFromDocuments(documents: DocumentRow[]): Record<string, ComplianceItem[]> {
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
  return groups
}

export function ClientTabs({
  clientId,
  clientName,
  hoursBalance,
  contactName,
  contactEmail,
  contactPhone,
  documents,
  proposals,
  assessments,
  hoursLog,
  assignments = [],
  publishedTemplates = [],
}: ClientTabsProps) {
  const compliance = buildComplianceFromDocuments(documents)
  const complianceCategories = Object.keys(compliance)

  // Active count = assignments that are not completed
  const activeAssignmentCount = assignments.filter(
    (a) => a.status !== "completed"
  ).length

  function formatDueDate(dateStr: string | null): string {
    if (!dateStr) return "no due date"
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  function assignmentStatusClass(status: string): string {
    if (status === "in_progress") return "text-[#c0a66d] bg-[#c0a66d]/10"
    if (status === "completed") return "text-[#3b8273] bg-[#3b8273]/10"
    return "text-[#666] bg-[#555]/10"
  }

  function assignmentStatusLabel(status: string): string {
    if (status === "in_progress") return "In progress"
    if (status === "completed") return "Completed"
    return "Pending"
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Contact info row */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Contact</span>
            <span className="text-white text-sm">{contactName ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Email</span>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="text-white text-sm hover:text-gold transition-colors break-all">
                {contactEmail}
              </a>
            ) : (
              <span className="text-white text-sm">—</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">Phone</span>
            <span className="text-white text-sm">{contactPhone ?? "—"}</span>
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
          <TabsTrigger value="assignments" className="font-mono text-[10px] uppercase tracking-widest gap-2 px-1 pb-3 pt-0 data-active:text-white text-white/40">
            <ClipboardList className="w-3.5 h-3.5" /> Assigned Forms{activeAssignmentCount > 0 ? ` (${activeAssignmentCount})` : ""}
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
          {complianceCategories.length === 0 ? (
            <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-10 text-center flex flex-col items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-white/20 mb-3" />
              <p className="text-white/50 text-sm">No compliance documents on file yet.</p>
              <p className="text-white/30 text-xs mt-1">Upload one from the Documents tab to start the record.</p>
            </Card>
          ) : (
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
          )}
        </TabsContent>

        {/* ASSESSMENTS */}
        <TabsContent value="assessments" className="pt-6">
          {assessments.length === 0 ? (
            <Card className="bg-[#1c1c1c] border-white/5 rounded-sm p-10 text-center flex flex-col items-center justify-center">
              <ClipboardCheck className="w-8 h-8 text-white/20 mb-3" />
              <p className="text-white/50 text-sm">No assessments yet.</p>
              <p className="text-white/30 text-xs mt-1">Assessments delivered to this client will appear here.</p>
            </Card>
          ) : (
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
          )}
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
            {hoursLog.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center">
                <Clock className="w-8 h-8 text-white/20 mb-3" />
                <p className="text-white/50 text-sm">No hours transactions yet.</p>
                <p className="text-white/30 text-xs mt-1">Adjustments and purchases will appear here.</p>
              </div>
            ) : (
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
            )}
          </Card>
        </TabsContent>
        {/* ASSIGNED FORMS */}
        <TabsContent value="assignments" className="pt-6">
          <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
            {/* Tab header: title + Assign template button */}
            <div className="px-6 py-4 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4 text-white/40" />
                <h3 className="font-sans font-medium text-white tracking-wide text-lg">Assigned forms</h3>
                {assignments.length > 0 && (
                  <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-3 leading-none">
                    {assignments.length} form{assignments.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <AssignTemplateModal
                preselectClientId={clientId}
                clients={[{ id: clientId, name: clientName }]}
                templates={publishedTemplates}
                triggerLabel="Assign template"
              />
            </div>

            {/* Empty state */}
            {assignments.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center">
                <ClipboardList className="w-8 h-8 text-white/20 mb-3" />
                <p className="text-white/50 text-sm font-serif text-lg">No forms assigned to this client yet.</p>
                <p className="text-white/30 text-xs mt-1">Use &ldquo;Assign template&rdquo; above to assign a published template.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Template name */}
                      <div className="text-base font-medium text-white font-serif truncate">
                        {assignment.template?.name ?? "—"}
                      </div>
                      {/* Metadata row: due date + status pill + overdue indicator */}
                      {(() => {
                        const d = daysOverdue(assignment.due_date);
                        const overdue = d >= 1 && assignment.status !== "completed";
                        // When overdue, the bold OVERDUE pill IS the status — suppress the
                        // redundant "Pending" pill, but keep a meaningful "In progress".
                        const showStatusPill = !overdue || assignment.status === "in_progress";
                        return (
                          <>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="font-mono text-[10px] uppercase tracking-widest text-[#666]">
                                DUE · {formatDueDate(assignment.due_date)}
                              </span>
                              {showStatusPill && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] leading-none ${assignmentStatusClass(assignment.status)}`}
                                >
                                  {assignmentStatusLabel(assignment.status)}
                                </span>
                              )}
                              {overdue && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] text-[#a14a2a] bg-[#a14a2a]/10">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                            {overdue && (
                              <p className="text-xs text-[#a14a2a] mt-1">
                                Was due {d} day{d === 1 ? "" : "s"} ago
                              </p>
                            )}
                          </>
                        );
                      })()}
                      {/* Instructions (if present) */}
                      {assignment.instructions && (
                        <p className="text-sm text-white/60 line-clamp-2 mt-1">
                          {assignment.instructions}
                        </p>
                      )}
                    </div>
                    {/* Actions: start an assessment from this assignment, or revoke it */}
                    {assignment.status !== "completed" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {assignment.template_version_id && (
                          <Link
                            href={`/admin/assessments/new?clientId=${clientId}&templateVersionId=${assignment.template_version_id}`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-[#c0a66d] hover:bg-[#c0a66d]/90 text-black font-medium font-mono text-[10px] uppercase tracking-widest transition-colors"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            Start assessment
                          </Link>
                        )}
                        <RevokeAssignmentButton assignmentId={assignment.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { adminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RevokeAssignmentButton } from "./revoke-assignment-button";

export const dynamic = "force-dynamic";

// Status pill colours per UI-SPEC § "Status pill spec"
function StatusPill({ status }: { status: string }) {
  const classes =
    status === "in_progress"
      ? "text-[#c0a66d] bg-[#c0a66d]/10"
      : status === "completed"
        ? "text-[#3b8273] bg-[#3b8273]/10"
        : "text-[#666] bg-[#555]/10";

  const label =
    status === "in_progress"
      ? "In progress"
      : status === "completed"
        ? "Completed"
        : "Pending";

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] leading-none ${classes}`}
    >
      {label}
    </span>
  );
}

// Due-date colour-coding per UI-SPEC
function dueDateClass(dueDate: string | null): string {
  if (!dueDate) return "text-[#666]";
  const d = new Date(dueDate);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "text-[#e55a3a]"; // overdue
  if (diffDays <= 3) return "text-gold"; // due within 3 days
  return "text-[#666]";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type FilterOption = { value: string; label: string };

function FilterPillGroup({
  label,
  param,
  options,
  active,
  baseUrl,
  currentParams,
}: {
  label: string;
  param: string;
  options: FilterOption[];
  active: string | undefined;
  baseUrl: string;
  currentParams: { status?: string; client?: string; template?: string };
}) {
  function buildUrl(value: string | null) {
    const p: Record<string, string> = {};
    if (currentParams.status) p.status = currentParams.status;
    if (currentParams.client) p.client = currentParams.client;
    if (currentParams.template) p.template = currentParams.template;
    if (value) {
      p[param] = value;
    } else {
      delete p[param];
    }
    const qs = new URLSearchParams(p).toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-widest text-[#555]">
        {label}
      </span>
      <Link
        href={buildUrl(null)}
        className={`font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm transition-colors ${
          !active
            ? "text-white bg-white/10"
            : "text-[#666] hover:text-white/60"
        }`}
      >
        All
      </Link>
      {options.map((opt) => (
        <Link
          key={opt.value}
          href={buildUrl(opt.value)}
          className={`font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm transition-colors ${
            active === opt.value
              ? "text-white bg-white/10"
              : "text-[#666] hover:text-white/60"
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}

export default async function AssignmentsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; template?: string }>;
}) {
  const { status, client, template } = await searchParams;

  // Build the base query
  let query = adminClient
    .from("form_assignments")
    .select(
      "id, status, due_date, instructions, created_at, client:clients(id, name), template:form_templates(id, name)"
    )
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  // Conditionally apply filters only when non-empty
  if (status && status.length > 0) {
    query = query.eq("status", status);
  }
  if (client && client.length > 0) {
    query = query.eq("client_id", client);
  }
  if (template && template.length > 0) {
    query = query.eq("template_id", template);
  }

  const { data: assignments, error } = await query;

  if (error) {
    console.error("Failed to load assignments:", error);
  }

  const rows = assignments ?? [];

  const currentParams = {
    status: status || undefined,
    client: client || undefined,
    template: template || undefined,
  };

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-widest">
            Back to Dashboard
          </span>
        </Link>
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
          <span className="text-gold font-semibold">07</span>
          ASSIGNMENT QUEUE
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-white">
          Active Assignments
        </h2>
        <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
          All assignments across clients. Sort by due date; filter by status,
          client, or template.
        </p>
      </div>

      {/* ─── FILTER BAR ─── */}
      <div className="flex flex-wrap gap-6 items-center">
        <FilterPillGroup
          label="Status"
          param="status"
          options={[
            { value: "pending", label: "Pending" },
            { value: "in_progress", label: "In progress" },
            { value: "completed", label: "Completed" },
          ]}
          active={status}
          baseUrl="/admin/assignments"
          currentParams={currentParams}
        />
      </div>

      {/* ─── TABLE ─── */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-[#151515]">
            <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
              <th className="font-normal px-6 py-4 border-b border-white/5">
                Template
              </th>
              <th className="font-normal px-4 py-4 border-b border-white/5">
                Client
              </th>
              <th className="font-normal px-4 py-4 border-b border-white/5">
                Due Date
              </th>
              <th className="font-normal px-4 py-4 border-b border-white/5">
                Status
              </th>
              <th className="font-normal px-4 py-4 border-b border-white/5">
                Instructions
              </th>
              <th className="font-normal px-6 py-4 border-b border-white/5 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-12 text-[#666] font-sans text-sm"
                >
                  No assignments matching the current filters.{" "}
                  <Link
                    href="/admin/assignments"
                    className="underline hover:text-white/80 transition-colors"
                  >
                    Clear filters
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const templateData = row.template as
                  | { id: string; name: string }
                  | null;
                const clientData = row.client as
                  | { id: string; name: string }
                  | null;
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 text-white font-medium">
                      {templateData?.name ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      {clientData ? (
                        <Link
                          href={`/admin/clients/${clientData.id}`}
                          className="hover:text-white transition-colors"
                        >
                          {clientData.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`px-4 py-4 font-mono text-xs ${dueDateClass(row.due_date)}`}
                    >
                      {formatDate(row.due_date)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-4 py-4 text-white/60 max-w-xs">
                      {row.instructions ? (
                        <p className="text-sm line-clamp-2">
                          {row.instructions}
                        </p>
                      ) : (
                        <span className="text-[#666]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {row.status !== "completed" && (
                        <RevokeAssignmentButton assignmentId={row.id} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

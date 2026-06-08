"use server";

import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { assertClientActive } from "@/lib/clients/require-active";

export interface CreateAssignmentsInput {
  dueDate?: string;
  instructions?: string;
}

// ── createAssignments ────────────────────────────────────────────────────────
// Creates one form_assignments row per selected client, all pinned to the
// latest published version of the given template.
// T-16-02, T-16-07: requireActorUserId("admin") is the first statement.

export async function createAssignments(
  templateId: string,
  clientIds: string[],
  opts?: CreateAssignmentsInput
): Promise<{ created: number }> {
  // T-16-02, T-16-07: admin-role gate. requireActorUserId("admin") only checked
  // for *any* authenticated user (the "admin" arg was ignored) — a client user
  // could create assignments via the service-role adminClient. requireAdmin()
  // enforces admin_users membership and stays demo-compatible.
  const adminUserId = await requireAdmin();

  if (clientIds.length === 0) {
    throw new Error("Select at least one client");
  }

  // Frozen-client guard — can't assign templates to a deactivated client.
  await Promise.all(clientIds.map((id) => assertClientActive(id)));

  // Resolve the latest published template_versions row for this template
  const { data: pubVersion, error: versionError } = await adminClient
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .not("published_at", "is", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) throw new Error(versionError.message);
  if (!pubVersion) throw new Error("Template has no published version");

  const rows = clientIds.map((clientId) => ({
    client_id: clientId,
    template_id: templateId,
    template_version_id: pubVersion.id,
    assigned_by: adminUserId,
    due_date: opts?.dueDate ?? null,
    instructions: opts?.instructions ?? null,
    status: "pending",
  }));

  const { error: insertError } = await adminClient
    .from("form_assignments")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);

  // Revalidate all affected paths
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/templates/${templateId}`);
  for (const clientId of clientIds) {
    revalidatePath(`/admin/clients/${clientId}`);
  }

  return { created: clientIds.length };
}

// ── updateAssignment ─────────────────────────────────────────────────────────
// Edits due_date and/or instructions on a pending or in_progress assignment.
// Throws if the assignment is completed (D-03 immutability).
// T-16-02, T-16-07: requireActorUserId("admin") is the first statement.

export async function updateAssignment(
  assignmentId: string,
  patch: { dueDate?: string | null; instructions?: string | null }
): Promise<void> {
  // T-16-02, T-16-07: admin-role gate (was requireActorUserId, auth-only).
  await requireAdmin();

  const { data: current, error: readError } = await adminClient
    .from("form_assignments")
    .select("status, client_id")
    .eq("id", assignmentId)
    .single();

  if (readError || !current) throw new Error("Assignment not found");
  if (current.status === "completed") {
    throw new Error("Cannot edit a completed assignment");
  }

  // Build a sparse update — only include keys that are explicitly in patch
  const update: Record<string, unknown> = {};
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate;
  if (patch.instructions !== undefined) update.instructions = patch.instructions;

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await adminClient
      .from("form_assignments")
      .update(update)
      .eq("id", assignmentId);

    if (updateError) throw new Error(updateError.message);
  }

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/clients/${current.client_id}`);
}

// ── revokeAssignment ─────────────────────────────────────────────────────────
// Soft-deletes a form_assignments row by setting deleted_at.
// Never uses hard-delete — follows the project-wide soft-delete convention.
// T-16-02, T-16-07: requireActorUserId("admin") is the first statement.

export async function revokeAssignment(assignmentId: string): Promise<void> {
  // T-16-02, T-16-07: admin-role gate (was requireActorUserId, auth-only).
  await requireAdmin();

  const { data: current, error: readError } = await adminClient
    .from("form_assignments")
    .select("client_id")
    .eq("id", assignmentId)
    .single();

  if (readError || !current) throw new Error("Assignment not found");

  const { error: updateError } = await adminClient
    .from("form_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/clients/${current.client_id}`);
}

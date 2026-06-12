"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAssignments } from "@/app/admin/assignments/actions";

export interface AssignTemplateModalProps {
  /** Pre-fill the template picker when launched from the template detail page. */
  templateId?: string;
  /** Pre-check one client when launched from the client detail page. */
  preselectClientId?: string;
  /** Picker options — required when templateId is not provided. */
  templates?: Array<{ id: string; name: string }>;
  /** Full list of available clients. */
  clients: Array<{ id: string; name: string }>;
  /** Trigger button label. */
  triggerLabel?: string;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function AssignTemplateModal({
  templateId,
  preselectClientId,
  templates,
  clients,
  triggerLabel = "Assign to clients",
}: AssignTemplateModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    templateId ?? ""
  );
  const [selectedClients, setSelectedClients] = useState<Set<string>>(
    () => new Set(preselectClientId ? [preselectClientId] : [])
  );
  const [dueDate, setDueDate] = useState<string>(defaultDueDate);
  const [instructions, setInstructions] = useState<string>("");

  function toggleClient(clientId: string, checked: boolean) {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(clientId);
      } else {
        next.delete(clientId);
      }
      return next;
    });
  }

  function resetForm() {
    setSelectedTemplate(templateId ?? "");
    setSelectedClients(new Set(preselectClientId ? [preselectClientId] : []));
    setDueDate(defaultDueDate());
    setInstructions("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedTemplate) {
      toast.error("Select at least one client to assign");
      return;
    }
    if (selectedClients.size === 0) {
      toast.error("Select at least one client to assign");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createAssignments(
          selectedTemplate,
          Array.from(selectedClients),
          {
            dueDate: dueDate || undefined,
            instructions: instructions.trim() || undefined,
          }
        );
        const n = result.created;
        toast.success(
          `Assigned to ${n} client${n > 1 ? "s" : ""}`
        );
        setOpen(false);
        resetForm();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Assignment failed — please try again or contact support"
        );
      }
    });
  }

  const isSubmitDisabled =
    pending || !selectedTemplate || selectedClients.size === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">
            Assign template
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
          {/* (a) Template picker — hidden when templateId prop is provided */}
          {!templateId && (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="templatePicker"
                className="text-foreground/70 font-mono text-xs uppercase tracking-widest"
              >
                Template
              </Label>
              <Select
                value={selectedTemplate}
                onValueChange={(v) => setSelectedTemplate(v ?? "")}
                // items maps value→label so SelectValue renders the template
                // NAME (not the raw id) once a template is picked.
                items={Object.fromEntries(
                  (templates ?? []).map((t) => [t.id, t.name])
                )}
                required
              >
                <SelectTrigger className="w-full h-10 bg-background border-border text-foreground data-placeholder:text-muted-foreground">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent className="w-[--anchor-width] max-h-64 bg-card border-border text-foreground">
                  {(templates ?? []).map((t) => (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      className="text-foreground/90 data-highlighted:bg-muted data-highlighted:text-foreground focus:bg-muted focus:text-foreground"
                    >
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* (b) Clients — bare text when launched from a client page, else a checkbox grid */}
          <div className="flex flex-col gap-2">
            <Label className="text-foreground/70 font-mono text-xs uppercase tracking-widest">
              {preselectClientId ? "Client" : "Clients"}
            </Label>
            {preselectClientId ? (
              <p className="text-foreground text-sm font-sans">
                {clients.find((c) => c.id === preselectClientId)?.name ??
                  "this client"}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-1">
                {clients.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`client-${c.id}`}
                      checked={selectedClients.has(c.id)}
                      onCheckedChange={(checked) =>
                        toggleClient(c.id, Boolean(checked))
                      }
                      className="border-border data-checked:bg-gold data-checked:border-gold"
                    />
                    <Label
                      htmlFor={`client-${c.id}`}
                      className="text-foreground text-sm font-sans cursor-pointer"
                    >
                      {c.name}
                    </Label>
                  </div>
                ))}
                {clients.length === 0 && (
                  <p className="text-muted-foreground text-xs font-mono">
                    No clients available
                  </p>
                )}
              </div>
            )}
          </div>

          {/* (c) Due date */}
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="dueDate"
              className="text-foreground/70 font-mono text-xs uppercase tracking-widest"
            >
              Due date
            </Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-background border-border text-foreground"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* (d) Instructions */}
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="instructions"
              className="text-foreground/70 font-mono text-xs uppercase tracking-widest"
            >
              Instructions (optional)
            </Label>
            <Textarea
              id="instructions"
              name="instructions"
              placeholder="Optional instructions for the client…"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="bg-background border-border text-foreground resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              className="bg-gold hover:bg-gold/90 text-gold-foreground font-medium rounded-sm px-5 h-9 text-sm tracking-wide border-none disabled:opacity-40"
            >
              {pending ? "Assigning…" : "Assign template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

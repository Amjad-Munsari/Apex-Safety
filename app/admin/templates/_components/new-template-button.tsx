"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createTemplate } from "../actions";

export function NewTemplateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("fra");

  async function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const id = await createTemplate(name.trim(), type);
      setShowModal(false);
      router.push(`/admin/templates/${id}`);
    });
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none"
      >
        + New Template
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-sm w-full max-w-md p-8 flex flex-col gap-6">
            <h3 className="font-serif text-2xl text-foreground">New Template</h3>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Fire Risk Assessment (Type 3)"
                className="bg-transparent border border-border rounded-sm px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-border/60 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="bg-background border border-border rounded-sm px-4 py-3 text-foreground text-sm outline-none focus:border-border/60 transition-colors"
              >
                <option value="fra">Fire Risk Assessment</option>
                <option value="site-risk">Site Risk Assessment</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm px-6"
              >
                {isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

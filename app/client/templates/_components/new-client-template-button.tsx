"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClientTemplate } from "../actions";

export function NewClientTemplateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createClientTemplate(name);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setShowModal(false);
        router.push(`/client/templates/${result.id}`);
      } catch {
        setError("Could not create the template. Nothing was saved.");
      }
    });
  }

  return (
    <>
      <Button
        onClick={() => {
          setError(null);
          setShowModal(true);
        }}
        className="rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-6 font-bold text-[10px] uppercase tracking-[0.25em] shadow-none"
      >
        + New Template
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-sm w-full max-w-md p-8 flex flex-col gap-6 shadow-xl">
            <h3 className="font-serif text-2xl text-foreground">New Template</h3>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Daily Fire Door Walkaround"
                maxLength={160}
                className="bg-card border border-border rounded-sm px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-foreground/40 transition-colors"
                autoFocus
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setShowModal(false);
                }}
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

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

  async function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const id = await createClientTemplate(name.trim());
      setShowModal(false);
      router.push(`/client/templates/${id}`);
    });
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        className="rounded-sm bg-[#1a1a1a] hover:bg-black text-white h-10 px-6 font-bold text-[10px] uppercase tracking-[0.25em] shadow-none"
      >
        + New Template
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e5e1d8] rounded-sm w-full max-w-md p-8 flex flex-col gap-6 shadow-xl">
            <h3 className="font-serif text-2xl text-[#1a1a1a]">New Template</h3>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#8a857f]">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Daily Fire Door Walkaround"
                className="bg-white border border-[#e5e1d8] rounded-sm px-4 py-3 text-[#1a1a1a] text-sm placeholder:text-[#a8a39d] outline-none focus:border-[#1a1a1a]/40 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowModal(false)}
                className="text-[#6b6560] hover:text-black"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || isPending}
                className="bg-[#1a1a1a] hover:bg-black text-white rounded-sm px-6"
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

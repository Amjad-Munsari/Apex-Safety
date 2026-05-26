"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActivePillProps {
  count: number;
}

export function ActivePill({ count }: ActivePillProps) {
  if (count === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] text-[#c0a66d] bg-[#c0a66d]/10 leading-none">
            {count}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {count} active assignment{count === 1 ? "" : "s"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

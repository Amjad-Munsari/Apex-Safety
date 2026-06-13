"use client"

import * as React from "react"
import { CheckCircle2 } from "lucide-react"
import { BRAND } from "@/lib/branding"

const colors = [BRAND.teal, "#c0a66d", BRAND.gold, "#1a1a1a", "#e06050"]

type Confetti = { id: number; left: number; delay: number; rotate: number; color: string }

export function SignSuccess({ title, message }: { title: string; message: string }) {
  const [confetti] = React.useState<Confetti[]>(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      rotate: Math.random() * 360,
      color: colors[i % colors.length],
    })),
  )

  return (
    <div className="relative bg-card border border-border rounded-sm p-12 flex flex-col items-center justify-center text-center overflow-hidden min-h-[420px]">
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="absolute top-0 w-1.5 h-3 block"
            style={{
              left: `${c.left}%`,
              background: c.color,
              transform: `rotate(${c.rotate}deg)`,
              animation: `confetti-fall 1.6s ${c.delay}s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
            }}
          />
        ))}
      </div>

      {/* Icon */}
      <div className="relative w-16 h-16 rounded-full bg-teal/10 ring-1 ring-teal/20 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-8 h-8 text-teal" />
      </div>

      <div className="space-y-2 relative">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-teal font-bold">
          Signed & Sealed
        </div>
        <h3 className="font-serif text-[28px] text-foreground tracking-tight">{title}</h3>
        <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">{message}</p>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-40px) rotate(0deg);   opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(440px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

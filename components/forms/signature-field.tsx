"use client"

import React, { useEffect, useRef, useState } from "react"
import type SignaturePadType from "signature_pad"
import { Eraser, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-surface"

interface SignatureFieldProps {
  value: string | undefined // base64 PNG data URL once captured
  onChange: (value: string | null) => void
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    canvas: "border-border bg-white",
    canvasActive: "border-gold/50",
    instruction: "text-muted-foreground",
    actionGhost: "text-muted-foreground hover:text-foreground hover:bg-muted",
    actionPrimary: "bg-gold text-gold-foreground hover:bg-gold/90",
    preview: "border-border bg-white",
    previewMeta: "text-muted-foreground",
    inkColor: "#1a1a1a",
  },
  cream: {
    canvas: "border-border bg-white",
    canvasActive: "border-gold/60",
    instruction: "text-muted-foreground",
    actionGhost: "text-muted-foreground hover:text-foreground hover:bg-muted",
    actionPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    preview: "border-border bg-white",
    previewMeta: "text-muted-foreground",
    inkColor: "#1a1a1a",
  },
} as const

const CANVAS_HEIGHT = 180

export function SignatureField({ value, onChange, surface = "dark" }: SignatureFieldProps) {
  const t = surfaceTokens[surface]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadType | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [editing, setEditing] = useState(!value)

  useEffect(() => {
    if (!editing) return
    const canvas = canvasRef.current
    if (!canvas) return

    let observer: ResizeObserver | null = null
    let cancelled = false

    import("signature_pad").then((mod) => {
      if (cancelled) return
      const SignaturePad = mod.default

      // backgroundColor transparent so toDataURL produces a PNG with a transparent
      // background (matching original behaviour).
      const pad = new SignaturePad(canvas, {
        penColor: t.inkColor,
        backgroundColor: "rgba(0,0,0,0)",
      })

      // Sync the canvas bitmap resolution to its displayed CSS size and scale the
      // drawing context by devicePixelRatio. signature_pad reports stroke points in
      // CSS pixels (via getBoundingClientRect), so if the HiDPI bitmap isn't matched
      // by a corresponding context transform, strokes render at 1/dpr of the cursor
      // position — offset toward the top-left, proportional to distance and worse on
      // high-dpr devices (Surface Pro / iPad). Setting width/height also resets the
      // context transform, so the scale must be re-applied on every resize.
      const resizeCanvas = () => {
        const width = canvas.offsetWidth
        const height = canvas.offsetHeight
        if (!width || !height) return // not laid out / hidden — skip degenerate sizing
        const dpr = Math.max(window.devicePixelRatio || 1, 1)
        const data = pad.toData() // preserve any in-progress strokes across the resize
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext("2d")
        if (ctx) ctx.scale(dpr, dpr)
        pad.clear() // assigning width/height wiped the bitmap; reset pad state...
        if (data.length) pad.fromData(data) // ...then restore strokes under the new transform
      }

      resizeCanvas()

      // Re-sync on container / orientation / viewport changes. Observing the canvas
      // is safe: resizeCanvas changes the bitmap (width/height attributes), not the
      // CSS box the observer measures, so it cannot loop.
      observer = new ResizeObserver(() => resizeCanvas())
      observer.observe(canvas)

      // Track active stroke for the border highlight.
      const onBegin = () => setIsDrawing(true)
      const onEnd = () => {
        setIsDrawing(false)
        setHasStrokes(!pad.isEmpty())
      }

      pad.addEventListener("beginStroke", onBegin)
      pad.addEventListener("endStroke", onEnd)

      padRef.current = pad
    })

    return () => {
      cancelled = true
      observer?.disconnect()
      if (padRef.current) {
        padRef.current.off()
        padRef.current = null
      }
    }
  }, [editing, t.inkColor])

  const clear = () => {
    padRef.current?.clear()
    setHasStrokes(false)
  }

  const done = () => {
    const pad = padRef.current
    if (!pad || !hasStrokes) return
    const dataUrl = pad.toDataURL("image/png")
    onChange(dataUrl)
    setEditing(false)
  }

  const reEdit = () => {
    setEditing(true)
    setHasStrokes(false)
  }

  const remove = () => {
    onChange(null)
    setEditing(true)
    setHasStrokes(false)
  }

  if (!editing && value) {
    return (
      <div className="space-y-3">
        <div className={cn("rounded-sm border p-3", t.preview)}>
          <img
            src={value}
            alt="Captured signature"
            className="w-full max-h-40 object-contain"
            style={{ height: CANVAS_HEIGHT }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-mono uppercase tracking-wider", t.previewMeta)}>
            Signed
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reEdit}
              className={cn("h-8 gap-1.5 text-xs", t.actionGhost)}
            >
              <Eraser className="h-3.5 w-3.5" />
              Redraw
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              className={cn("h-8 gap-1.5 text-xs", t.actionGhost)}
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        style={{ height: CANVAS_HEIGHT, touchAction: "none" }}
        className={cn(
          "w-full rounded-sm border cursor-crosshair transition-colors",
          isDrawing ? t.canvasActive : t.canvas
        )}
      />
      <div className="flex items-center justify-between">
        <span className={cn("text-xs", t.instruction)}>
          {hasStrokes ? "Tap Done to capture." : "Sign with mouse or finger."}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={!hasStrokes}
            className={cn("h-8 gap-1.5 text-xs", t.actionGhost)}
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={done}
            disabled={!hasStrokes}
            className={cn("h-8 gap-1.5 text-xs rounded-sm", t.actionPrimary)}
          >
            <Check className="h-3.5 w-3.5" />
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

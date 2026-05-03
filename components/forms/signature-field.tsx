"use client"

import React, { useEffect, useRef, useState } from "react"
import { Eraser, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-renderer"

interface SignatureFieldProps {
  value: string | undefined // base64 PNG data URL once captured
  onChange: (value: string | null) => void
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    canvas: "border-slate-800 bg-slate-950",
    canvasActive: "border-amber-500/50",
    instruction: "text-slate-500",
    actionGhost: "text-slate-400 hover:text-slate-100 hover:bg-slate-900",
    actionPrimary: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    preview: "border-slate-800 bg-slate-950",
    previewMeta: "text-slate-500",
    inkColor: "#f8fafc", // slate-50 — readable on dark canvas
  },
  cream: {
    canvas: "border-[#e5e1d8] bg-white",
    canvasActive: "border-amber-500/60",
    instruction: "text-[#6b6560]",
    actionGhost: "text-[#6b6560] hover:text-[#1a1a1a] hover:bg-[#faf9f6]",
    actionPrimary: "bg-[#1a1a1a] text-white hover:bg-black",
    preview: "border-[#e5e1d8] bg-white",
    previewMeta: "text-[#6b6560]",
    inkColor: "#1a1a1a",
  },
} as const

const CANVAS_HEIGHT = 180

function getPos(canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) {
  const rect = canvas.getBoundingClientRect()
  if ("touches" in e) {
    const touch = e.touches[0] ?? e.changedTouches[0]
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

export function SignatureField({ value, onChange, surface = "dark" }: SignatureFieldProps) {
  const t = surfaceTokens[surface]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [editing, setEditing] = useState(!value)

  useEffect(() => {
    if (!editing) return
    const canvas = canvasRef.current
    if (!canvas) return

    // Size the bitmap to match the rendered CSS box for crisp lines on retina.
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 2
    ctx.strokeStyle = t.inkColor
  }, [editing, t.inkColor])

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(canvas, e.nativeEvent)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(canvas, e.nativeEvent)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasStrokes) setHasStrokes(true)
  }

  const handleEnd = () => {
    setIsDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }

  const done = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes) return
    const dataUrl = canvas.toDataURL("image/png")
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
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
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

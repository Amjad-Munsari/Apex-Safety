"use client"

import React, { useEffect, useState } from "react"
import { MapPin, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FormSurface } from "./form-renderer"

interface GeoValue {
  lat: number
  lng: number
  accuracy?: number
  capturedAt?: string
}

interface GeolocationFieldProps {
  value: GeoValue | undefined
  onChange: (value: GeoValue | null) => void
  surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    panel: "border-slate-800 bg-slate-950",
    icon: "text-amber-500",
    coord: "text-slate-100",
    meta: "text-slate-500",
    error: "text-red-400",
    btn: "text-slate-400 hover:text-amber-500 hover:bg-slate-900",
  },
  cream: {
    panel: "border-[#e5e1d8] bg-white",
    icon: "text-[#1a1a1a]",
    coord: "text-[#1a1a1a]",
    meta: "text-[#6b6560]",
    error: "text-[#8b2b21]",
    btn: "text-[#6b6560] hover:text-[#1a1a1a] hover:bg-[#faf9f6]",
  },
} as const

export function GeolocationField({ value, onChange, surface = "dark" }: GeolocationFieldProps) {
  const t = surfaceTokens[surface]
  const [status, setStatus] = useState<"idle" | "loading" | "denied" | "unavailable" | "error">(
    value ? "idle" : "loading"
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const capture = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable")
      setErrorMsg("Geolocation is not supported on this device.")
      return
    }
    setStatus("loading")
    setErrorMsg(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
        })
        setStatus("idle")
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied")
          setErrorMsg("Location permission was denied. Enable it in your browser to capture coordinates.")
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setStatus("unavailable")
          setErrorMsg("Location is currently unavailable.")
        } else {
          setStatus("error")
          setErrorMsg("Couldn't get your location. Try again.")
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  useEffect(() => {
    if (!value) capture()
    // We deliberately auto-capture only on mount when no value is present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn("rounded-sm border p-4 flex items-start gap-3", t.panel)}>
      <div className="pt-0.5">
        {status === "loading" ? (
          <Loader2 className={cn("h-5 w-5 animate-spin", t.icon)} />
        ) : status === "denied" || status === "unavailable" || status === "error" ? (
          <AlertCircle className={cn("h-5 w-5", t.error)} />
        ) : (
          <MapPin className={cn("h-5 w-5", t.icon)} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {status === "loading" && (
          <div className={cn("text-sm", t.meta)}>Acquiring GPS coordinates…</div>
        )}

        {status !== "loading" && value && (
          <div className="space-y-1">
            <div className={cn("font-mono text-sm tabular-nums", t.coord)}>
              Lat: {value.lat.toFixed(4)}, Lng: {value.lng.toFixed(4)}
            </div>
            {(value.accuracy != null || value.capturedAt) && (
              <div className={cn("text-[11px] font-mono uppercase tracking-wider", t.meta)}>
                {value.accuracy != null && <>±{Math.round(value.accuracy)}m</>}
                {value.accuracy != null && value.capturedAt && " · "}
                {value.capturedAt && new Date(value.capturedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {status !== "loading" && !value && errorMsg && (
          <div className={cn("text-sm", t.error)}>{errorMsg}</div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={capture}
        disabled={status === "loading"}
        className={cn("h-8 gap-1.5 text-xs shrink-0", t.btn)}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", status === "loading" && "animate-spin")} />
        Refresh
      </Button>
    </div>
  )
}

"use client"

import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const pathname = usePathname()
  const isClientSurface = pathname?.startsWith("/client") ?? false

  // Cream (client) surface uses warm off-white + ink text + earthy RAG so
  // toasts stay legible on the document-room palette instead of inheriting
  // the dark admin popover tokens.
  const creamStyle = {
    "--normal-bg": "#ffffff",
    "--normal-text": "#1a1a1a",
    "--normal-border": "#e5e1d8",
    "--success-bg": "#f4f7f0",
    "--success-text": "#3f5a2a",
    "--success-border": "#d6e0c8",
    "--info-bg": "#ffffff",
    "--info-text": "#1a1a1a",
    "--info-border": "#e5e1d8",
    "--warning-bg": "#fbf6ea",
    "--warning-text": "#7a5a14",
    "--warning-border": "#ecdcb8",
    "--error-bg": "#fbeeec",
    "--error-text": "#8a2b1c",
    "--error-border": "#ecc9c1",
    "--border-radius": "2px",
  } as React.CSSProperties

  const adminStyle = {
    "--normal-bg": "var(--popover)",
    "--normal-text": "var(--popover-foreground)",
    "--normal-border": "var(--border)",
    "--border-radius": "var(--radius)",
  } as React.CSSProperties

  return (
    <Sonner
      theme={(isClientSurface ? "light" : theme) as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={isClientSurface ? creamStyle : adminStyle}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

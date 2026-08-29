"use client"

import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Users, Eye } from "lucide-react"

export function PrototypeBar() {
  const pathname = usePathname()
  const router = useRouter()

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/client") && !pathname.startsWith("/login")) {
    return null
  }

  function handleDemoSwitch(targetPath: string) {
    document.cookie = "demo_mode=1; path=/; max-age=86400"
    router.push(targetPath)
    router.refresh()
  }

  const isAdmin = pathname.startsWith("/admin")
  const isClient = pathname.startsWith("/client")

  return (
    <div className="bg-[#18181b] text-white border-b border-white/10 px-4 py-2 flex items-center justify-between text-xs font-sans shrink-0 min-h-[41px] relative z-20">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] uppercase font-semibold tracking-wider border border-emerald-500/30">
          <Eye className="w-3 h-3" /> Prototype Showcase
        </span>
        <span className="hidden sm:inline text-white/50 text-[11px]">
          Interactive Demo — Full feature exploration without login
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleDemoSwitch("/admin")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
            isAdmin
              ? "bg-white text-black font-semibold shadow-sm"
              : "bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Admin Console
        </button>

        <button
          onClick={() => handleDemoSwitch("/client")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium transition-colors ${
            isClient
              ? "bg-white text-black font-semibold shadow-sm"
              : "bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Client Portal
        </button>
      </div>
    </div>
  )
}

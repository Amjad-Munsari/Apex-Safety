import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SettingsForm } from "@/components/admin/settings-form"

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
          <span className="text-white font-semibold">10</span>
          PRACTICE SETTINGS
        </div>
        <h2 className="font-serif text-[34px] leading-tight text-white">Settings.</h2>
        <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
          Branding, notifications, and the defaults that show up on every document the platform sends.
        </p>
      </div>

      <SettingsForm />
    </div>
  )
}

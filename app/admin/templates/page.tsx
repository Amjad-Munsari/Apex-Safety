import { getFormTemplates } from "@/lib/supabase/templates"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { 
  FileText, 
  Plus, 
  Settings2, 
  History,
  CheckCircle2,
  AlertCircle
} from "lucide-react"

export default async function AdminTemplatesPage() {
  const templates = await getFormTemplates()

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-[#3b8273] font-semibold">07</span>
            TEMPLATE SYSTEM
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">
            Form Templates
          </h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            Design and version your compliance forms. Changes to published templates will not affect historical submissions.
          </p>
        </div>
        
        <Button className="bg-white hover:bg-white/90 text-black rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none flex gap-2">
          <Plus className="w-4 h-4" /> Create Template
        </Button>
      </div>

      {/* ─── TEMPLATES GRID ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="bg-[#1c1c1c] border-white/5 rounded-sm p-6 flex flex-col gap-6 hover:border-white/10 transition-all group">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-white/5 rounded-sm group-hover:bg-white/10 transition-colors">
                <FileText className="w-6 h-6 text-white/70" />
              </div>
              <Badge variant="outline" className={cn(
                "rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-widest leading-none",
                template.is_published ? "border-[#3b8273]/40 text-[#3b8273]" : "border-gold/40 text-gold"
              )}>
                {template.is_published ? "Published" : "Draft"}
              </Badge>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-medium text-white tracking-tight">{template.name}</h3>
              <p className="text-xs text-[#666] font-mono uppercase tracking-widest">{template.template_type}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#555]">Version</span>
                <div className="text-white/80 font-mono text-sm">v1.2.0</div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#555]">Last Edit</span>
                <div className="text-white/80 font-mono text-sm">2d ago</div>
              </div>
            </div>

            <div className="mt-auto pt-4 flex gap-2">
              <Link href={`/admin/templates/${template.id}`} className="flex-1">
                <Button variant="secondary" className="w-full bg-white/5 hover:bg-white/10 border border-white/5 text-white/90 text-xs font-medium rounded-sm h-9 flex gap-2">
                  <Settings2 className="w-3.5 h-3.5" /> Edit Template
                </Button>
              </Link>
              <Button variant="outline" className="border-white/5 hover:bg-white/5 h-9 px-3">
                <History className="w-4 h-4 text-[#555]" />
              </Button>
            </div>
          </Card>
        ))}

        {/* Empty State / Add New Placeholder */}
        {templates.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-sm bg-white/[0.01]">
            <FileText className="w-12 h-12 text-[#333] mb-4" />
            <p className="text-[#555] font-mono text-xs uppercase tracking-widest">No templates found</p>
            <Button variant="link" className="text-white/40 mt-2 hover:text-white transition-colors">
              Seed example templates
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

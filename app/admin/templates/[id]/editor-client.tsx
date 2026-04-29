"use client"

import React, { useState } from "react"
import { FormSchema, FormField, FormSection } from "@/types/forms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  ChevronLeft, 
  Save, 
  Zap, 
  Plus, 
  Trash2, 
  GripVertical,
  Type,
  List,
  CheckSquare,
  Image as ImageIcon,
  Settings2,
  Calendar,
  FileText
} from "lucide-react"
import Link from "next/link"
import { updateTemplateDraftAction, publishTemplateVersionAction } from "../actions"
import { useRouter } from "next/navigation"

interface EditorClientProps {
  template: any
  initialSchema: FormSchema
  userId: string
}

export function EditorClient({ template, initialSchema, userId }: EditorClientProps) {
  const [schema, setSchema] = useState<FormSchema>(initialSchema)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const selectedField = schema.sections
    .flatMap(s => s.fields)
    .find(f => f.id === selectedFieldId)

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await updateTemplateDraftAction(template.id, schema)
      console.log("Draft saved")
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setSaving(true)
    try {
      await publishTemplateVersionAction(template.id, schema, userId)
      router.push("/admin/templates")
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const addField = (sectionId: string) => {
    const newField: FormField = {
      id: `field_${Math.random().toString(36).substr(2, 9)}`,
      label: "New Question",
      type: "text",
      required: false
    }

    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId 
          ? { ...s, fields: [...s.fields, newField] }
          : s
      )
    }))
    setSelectedFieldId(newField.id)
  }

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map(s => ({
        ...s,
        fields: s.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f)
      }))
    }))
  }

  const removeField = (fieldId: string) => {
    setSchema(prev => ({
      ...prev,
      sections: prev.sections.map(s => ({
        ...s,
        fields: s.fields.filter(f => f.id !== fieldId)
      }))
    }))
    if (selectedFieldId === fieldId) setSelectedFieldId(null)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-500">
      {/* ─── EDITOR HEADER ─── */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/admin/templates">
            <Button variant="ghost" size="icon" className="text-[#666] hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#3b8273] tracking-widest uppercase">Editor</span>
              <span className="text-[#333] font-mono text-[10px]">&middot;</span>
              <span className="font-mono text-[10px] text-[#666] uppercase">{template.template_type}</span>
            </div>
            <h1 className="text-2xl font-serif text-white font-medium">{template.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleSaveDraft}
            disabled={saving}
            className="border-white/5 hover:bg-white/5 text-white/70 text-xs font-medium rounded-sm px-5 flex gap-2"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button 
            onClick={handlePublish}
            disabled={saving}
            className="bg-[#3b8273] hover:bg-[#3b8273]/90 text-white rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none flex gap-2 shadow-lg shadow-[#3b8273]/10"
          >
            <Zap className="w-4 h-4" /> Publish v{schema.version + 1 || 1}
          </Button>
        </div>
      </div>

      {/* ─── MAIN EDITOR CANVAS ─── */}
      <div className="flex gap-8 flex-1 overflow-hidden">
        
        {/* Left: Section & Field List */}
        <div className="flex-1 overflow-y-auto pr-4 space-y-12 scrollbar-hide">
          {schema.sections.map((section, sIdx) => (
            <div key={section.id} className="space-y-4">
              <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-sm px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded-sm bg-white/5 flex items-center justify-center text-[10px] font-mono text-[#555]">
                    {sIdx + 1}
                  </div>
                  <Input 
                    value={section.title} 
                    onChange={(e) => {
                       const newSections = [...schema.sections]
                       newSections[sIdx] = { ...section, title: e.target.value }
                       setSchema({ ...schema, sections: newSections })
                    }}
                    className="bg-transparent border-none text-lg font-serif p-0 focus-visible:ring-0 w-80 text-white" 
                  />
                </div>
                <Button variant="ghost" size="icon" className="text-[#333] hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3 pl-10">
                {section.fields.map((field) => (
                  <div 
                    key={field.id} 
                    onClick={() => setSelectedFieldId(field.id)}
                    className={cn(
                      "bg-[#1c1c1c] border rounded-sm p-4 flex items-center gap-4 group transition-all cursor-pointer",
                      selectedFieldId === field.id ? "border-[#3b8273] ring-1 ring-[#3b8273]/20" : "border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="text-[#333] group-hover:text-[#555] transition-colors">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    
                    <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center">
                       {getFieldIcon(field.type)}
                    </div>

                    <div className="flex-1 space-y-0.5">
                      <div className="text-sm text-white/90 font-medium">{field.label}</div>
                      <div className="text-[10px] text-[#555] font-mono uppercase tracking-widest">{field.type}</div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <Button 
                  variant="ghost" 
                  onClick={() => addField(section.id)}
                  className="w-full border-2 border-dashed border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-[#555] text-xs font-mono uppercase tracking-widest py-8 flex gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add field to section
                </Button>
              </div>
            </div>
          ))}

          <Button className="w-full bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono uppercase tracking-widest py-10 rounded-sm border border-white/5 transition-colors">
             + Create New Section
          </Button>
        </div>

        {/* Right: Property Panel */}
        <div className="w-80 bg-[#1c1c1c] border border-white/5 rounded-sm p-6 space-y-6 shrink-0">
           <div className="flex flex-col gap-1 pb-4 border-b border-white/5">
             <span className="font-mono text-[10px] text-[#555] tracking-widest uppercase">Properties</span>
             <h4 className="text-white font-medium">Field Configuration</h4>
           </div>

           {selectedField ? (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="space-y-2">
                 <label className="text-[10px] font-mono uppercase text-[#666] tracking-widest">Field Label</label>
                 <Input 
                   value={selectedField.label}
                   onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                   className="bg-black border-white/10 rounded-sm text-sm text-white focus:border-[#3b8273]" 
                 />
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-mono uppercase text-[#666] tracking-widest">Input Type</label>
                 <select 
                   value={selectedField.type}
                   onChange={(e) => updateField(selectedField.id, { type: e.target.value as any })}
                   className="w-full bg-black border border-white/10 rounded-sm p-2 text-xs text-white outline-none focus:border-[#3b8273]"
                 >
                    <option value="text">Text Input</option>
                    <option value="textarea">Long Answer</option>
                    <option value="dropdown">Dropdown Selection</option>
                    <option value="media">Media (Photos/Audio)</option>
                    <option value="signature">Signature</option>
                    <option value="heading">Section Heading</option>
                 </select>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-mono uppercase text-[#666] tracking-widest">Help Text</label>
                 <Input 
                   value={selectedField.helpText || ""}
                   onChange={(e) => updateField(selectedField.id, { helpText: e.target.value })}
                   className="bg-black border-white/10 rounded-sm text-sm text-white" 
                   placeholder="Instructions for user..."
                 />
               </div>

               <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-[#888]">Required field</span>
                  <div 
                    onClick={() => updateField(selectedField.id, { required: !selectedField.required })}
                    className={cn(
                      "w-8 h-4 rounded-full relative cursor-pointer transition-colors",
                      selectedField.required ? "bg-[#3b8273]" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                      selectedField.required ? "right-0.5" : "left-0.5"
                    )}></div>
                  </div>
               </div>

               <div className="pt-10">
                 <Button 
                   variant="outline" 
                   onClick={() => removeField(selectedField.id)}
                   className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-mono uppercase tracking-widest"
                 >
                   Delete Field
                 </Button>
               </div>
             </div>
           ) : (
             <div className="pt-20 text-center">
               <p className="text-[10px] text-[#333] font-mono uppercase tracking-[0.2em] leading-relaxed">
                 Select a field on the canvas to configure its properties.
               </p>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}

function getFieldIcon(type: string) {
  switch(type) {
    case 'text': return <Type className="w-4 h-4 text-[#3b8273]" />
    case 'textarea': return <FileText className="w-4 h-4 text-amber-500" />
    case 'dropdown': return <List className="w-4 h-4 text-blue-500" />
    case 'media': return <ImageIcon className="w-4 h-4 text-emerald-500" />
    case 'signature': return <Zap className="w-4 h-4 text-purple-500" />
    default: return <CheckSquare className="w-4 h-4 text-slate-500" />
  }
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

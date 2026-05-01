import { Card } from "@/components/ui/card"
import { BookOpen, Send, ClipboardCheck, Users, ShieldCheck, Clock } from "lucide-react"

export default function AdminGuidePage() {
  const workflows = [
    {
      title: "Sales & Proposals",
      icon: Send,
      steps: [
        "Navigate to 'Clients' and select a prospect.",
        "Click '+ New Proposal' at the top right.",
        "Select services from the catalog—pricing updates automatically.",
        "Generate a professional AI scope of works with one click.",
        "Download the branded PDF to send to the client."
      ]
    },
    {
      title: "On-Site Assessments",
      icon: ClipboardCheck,
      steps: [
        "Open the portal on a mobile device or tablet.",
        "Start a 'New Assessment' for a client.",
        "Use Voice-to-Text to capture findings rapidly.",
        "Upload photos directly from your camera for evidence.",
        "Submit to trigger the AI Report drafting process."
      ]
    },
    {
      title: "Compliance Management",
      icon: ShieldCheck,
      steps: [
        "View the Dashboard 'Alerts' panel for expiring documents.",
        "Upload updated certificates via the Client Record page.",
        "Clients are notified automatically when new docs are live.",
        "Monitor RAG statuses (Red/Amber/Green) for all sites."
      ]
    }
  ]

  return (
    <div className="flex flex-col gap-10 max-w-5xl mx-auto w-full py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
          <BookOpen className="w-4 h-4" />
          Onboarding
        </div>
        <h2 className="font-serif text-[36px] text-white">Quick-Start Guide</h2>
        <p className="text-white/40 text-lg max-w-2xl">
          Welcome to the 888 Safety Admin Portal. This guide summarizes the core workflows designed to save you hours of paperwork.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {workflows.map((wf) => (
          <Card key={wf.title} className="bg-[#1c1c1c] border-white/5 rounded-sm p-8 flex flex-col gap-6">
            <div className="w-12 h-12 rounded-sm bg-white/5 flex items-center justify-center">
              <wf.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="font-sans font-medium text-white text-xl">{wf.title}</h3>
              <ul className="flex flex-col gap-3">
                {wf.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/60">
                    <span className="text-white/20 font-mono text-xs mt-1">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-white/5 border-dashed border-white/10 rounded-sm p-8 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h4 className="text-white font-medium">Need to manage client credits?</h4>
          <p className="text-white/40 text-sm">Use the "Adjust Balance" tool on any client record to manually add or deduct retained hours.</p>
        </div>
        <Clock className="w-8 h-8 text-white/20" />
      </Card>
    </div>
  )
}

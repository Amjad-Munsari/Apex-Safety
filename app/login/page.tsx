"use client"

import Link from "next/link"
import { ShieldCheck, UserCircle, ShieldAlert } from "lucide-react"

export default function LoginGatewayPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfaf5] p-6 relative overflow-hidden">
      
      {/* Background accents */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-black blur-[120px]" />
      </div>

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
           <div className="w-12 h-12 mx-auto rounded-full border border-black/10 flex items-center justify-center bg-white shadow-sm">
              <ShieldCheck className="w-6 h-6 text-black" />
           </div>
           <div>
             <h1 className="font-serif text-[42px] text-[#1a1a1a] leading-tight tracking-tight">
               888 Safety & Training
             </h1>
             <p className="font-mono text-[10px] tracking-[0.25em] text-[#999] uppercase font-bold mt-2">
               Access Gateway
             </p>
           </div>
        </div>

        {/* Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
           
           {/* Client Portal Card */}
           <Link href="/login/client" className="group">
             <div className="h-full bg-white border border-[#e5e1d8] rounded-md p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:border-black/20 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#fbfaf5] border border-[#e5e1d8] flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                   <UserCircle className="w-8 h-8 text-[#1a1a1a]" />
                </div>
                <h2 className="font-serif text-[24px] text-[#1a1a1a] mb-3">Client Portal</h2>
                <p className="text-[#888] font-sans text-[13px] leading-relaxed">
                  Access your compliance documentation, assessment reports, and track your retained consulting hours.
                </p>
                <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-[#1a1a1a] flex items-center gap-2 group-hover:gap-3 transition-all">
                  Client Login <span className="text-[14px]">→</span>
                </div>
             </div>
           </Link>

           {/* Admin Portal Card */}
           <Link href="/login/admin" className="group">
             <div className="h-full bg-[#111] border border-black rounded-md p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-black/20 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300">
                   <ShieldAlert className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-serif text-[24px] text-white mb-3">Admin Console</h2>
                <p className="text-white/50 font-sans text-[13px] leading-relaxed">
                  Manage clients, upload documentation, track upcoming expiries, and generate compliance reports.
                </p>
                <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2 group-hover:gap-3 transition-all">
                  Admin Login <span className="text-[14px] text-white/50 group-hover:text-white">→</span>
                </div>
             </div>
           </Link>

        </div>

        <div className="mt-20 font-sans text-[11px] text-[#bbb]">
          &copy; {new Date().getFullYear()} 888 Safety & Training Limited. All rights reserved.
        </div>

      </div>
    </div>
  )
}

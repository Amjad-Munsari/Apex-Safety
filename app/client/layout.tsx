"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  return (
    <div className="min-h-screen bg-[#fbfaf5] text-[#1a1a1a] font-sans antialiased text-sm">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-[#e5e1d8]">
        <div className="max-w-[1240px] mx-auto h-20 px-8 flex items-center justify-between">
          <div className="flex items-center gap-12">
            {/* Brand */}
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[8.5px] tracking-[0.25em] text-[#999] uppercase opacity-70">Cl-8889 &middot; Compliance Portal</span>
              <span className="font-serif text-[18px] text-[#1a1a1a] font-medium tracking-tight">Hallam House Care Home</span>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-8 ml-4">
              {[
                { id: "01", label: "Dashboard", href: "/client", active: pathname === "/client" },
                { id: "02", label: "Compliance", href: "/client/compliance", active: pathname === "/client/compliance" },
                { id: "03", label: "Reports", href: "/client/reports", active: pathname === "/client/reports" },
                { id: "04", label: "Hours & billing", href: "/client/billing", active: pathname === "/client/billing" },
              ].map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 group transition-all",
                    item.active ? "text-black" : "text-[#999] hover:text-black"
                  )}
                >
                  <span className={cn(
                    "font-mono text-[9px] tracking-[0.2em] transition-colors",
                    item.active ? "text-black" : "text-[#ccc] group-hover:text-[#999]"
                  )}>
                    {item.id}
                  </span>
                  <span className={cn(
                    "text-[12px] font-bold tracking-tight border-b-2 transition-all capitalize",
                    item.active ? "border-black pb-0.5" : "border-transparent pb-0 hover:border-[#ddd]"
                  )}>
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[12px] font-bold tracking-tight text-[#1a1a1a]">Sarah Whitfield</span>
              <span className="text-[8px] uppercase font-mono tracking-[0.2em] text-[#999] opacity-70 leading-none mt-0.5">Facilities Manager</span>
            </div>
            <Button variant="outline" className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[10px] uppercase tracking-[0.2em] h-10 px-6 font-bold shadow-none transition-all">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1024px] mx-auto px-10 py-8">
        {children}
      </main>

      {/* Portal Footer */}
      <footer className="max-w-[1024px] mx-auto px-10 py-8 mt-6 border-t border-[#e5e1d8]">
         <div className="flex justify-center items-center gap-6 font-mono text-[8.5px] tracking-[0.2em] text-[#999] uppercase">
           <span>Your Consultant</span>
           <span className="text-[#666] font-bold">&middot;</span>
           <span className="text-[#666] font-bold">Matt Dineen</span>
           <span className="text-[#666] font-bold">&middot;</span>
           <span className="text-[#666] font-bold">matt@dineen-fire.co.uk</span>
           <span className="text-[#666] font-bold">&middot;</span>
           <span className="text-[#666] font-bold">0161 552 0918</span>
         </div>
      </footer>
    </div>
  );
}

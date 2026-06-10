import { Suspense } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarStats } from "@/components/admin/sidebar-stats";
import { BrandingProvider } from "@/components/branding-provider";
import { AdminSearch } from "@/components/admin/admin-search";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <SidebarProvider>
      <div data-surface="admin" className="fixed inset-0 flex overflow-hidden bg-background text-foreground antialiased">
        <BrandingProvider />
        <Suspense fallback={<AppSidebar stats={{ clients: 0, expiries: 0, reports: 0, compliance: 0, proposals: 0, errors: 0 }} />}>
          <SidebarStats />
        </Suspense>
        <div className="flex-1 flex flex-col h-full max-h-full min-h-0 overflow-hidden">
          {/* Top Bar */}
          <header className="h-[72px] min-h-[72px] flex items-center justify-between px-8 border-b border-white/5 shrink-0 bg-background/50">
            {/* Search */}
            <AdminSearch />

            {/* Right Date and Action */}
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#555]">Today</span>
                <span className="text-sm font-medium text-white/90 font-sans tracking-wide">{today}</span>
              </div>
              <Link href="/admin/proposals/new">
                <Button variant="secondary" className="bg-white hover:bg-white/90 text-black rounded-sm px-4 font-medium text-[11px] h-8 tracking-wide border-none">
                  + New Proposal
                </Button>
              </Link>
              <Link href="/admin/assessments/new">
                <Button variant="secondary" className="bg-amber-500 hover:bg-amber-400 text-black rounded-sm px-4 font-medium text-[11px] h-8 tracking-wide border-none">
                  + New Assessment
                </Button>
              </Link>
            </div>
          </header>

          {/* Main Content Area — explicit bg so the dark surface covers the full
              scroll height (the root <body> is the light theme background; without
              this, content scrolled past the first viewport reveals white). */}
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-8 pb-8 bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

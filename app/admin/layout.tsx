import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminSearch } from "@/components/admin/admin-search";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AssessmentButtonDialog } from "@/components/assessments/assessment-button-dialog";
import { getDashboardStats } from "@/lib/supabase/dashboard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const stats = await getDashboardStats();

  const sidebarStats = {
    clients: stats.clientCount,
    expiries: stats.totalExpiries,
    reports: stats.reviewCount,
    compliance: stats.totalDocCount,
    proposals: stats.proposalCount,
    errors: stats.errorCount,
  };

  console.log('--- Sidebar Stats Audit ---');
  console.log(sidebarStats);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <SidebarProvider>
      <div data-surface="admin" className="flex h-screen overflow-hidden bg-background w-full text-foreground antialiased">
        <AppSidebar stats={sidebarStats} />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
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
              <AssessmentButtonDialog />
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto px-8 pb-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

import { AppSidebar } from "@/components/app-sidebar";
import { getDashboardStats } from "@/lib/supabase/dashboard";

export async function SidebarStats() {
  const stats = await getDashboardStats();

  const sidebarStats = {
    clients: stats.clientCount,
    expiries: stats.totalExpiries,
    reports: stats.reviewCount,
    compliance: stats.totalDocCount,
    proposals: stats.proposalCount,
    errors: stats.errorCount,
  };

  return <AppSidebar stats={sidebarStats} />;
}

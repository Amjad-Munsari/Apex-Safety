import { Suspense, type CSSProperties } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarStats } from "@/components/admin/sidebar-stats";
import { AdminSearch } from "@/components/admin/admin-search";
import { Button } from "@/components/ui/button";
import ThemeSwitch from "@/components/ui/theme-switch";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, isDemoMode } from "@/lib/auth-helpers";
import { getAppSettings } from "@/lib/settings/app-settings";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: proxy.ts already gates /admin, but the layout must not
  // trust the matcher regex alone. Demo mode keeps its dev-only bypass.
  if (!(await isDemoMode()) && !(await isAdmin())) {
    redirect("/login/admin");
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const { brandingPrimary, brandingSecondary } = await getAppSettings();

  return (
    <SidebarProvider
      // Slim the admin nav rail so the main content (esp. the Clients table) gets
      // more horizontal room. Overrides the shared 16rem default for this surface.
      style={{ "--sidebar-width": "13rem" } as CSSProperties}
    >
      <div
        data-surface="admin"
        style={{
          "--teal": brandingPrimary,
          "--gold": brandingSecondary,
        } as CSSProperties}
        className="fixed inset-0 flex overflow-hidden bg-background text-foreground antialiased"
      >
        <Suspense fallback={<AppSidebar stats={{ clients: 0, expiries: 0, reports: 0, compliance: 0, proposals: 0, errors: 0 }} />}>
          <SidebarStats />
        </Suspense>
        <div className="flex-1 flex flex-col h-full max-h-full min-h-0 overflow-hidden">
          {/* Top Bar */}
          <header className="h-[72px] min-h-[72px] flex items-center justify-between px-8 border-b border-border shrink-0 bg-background/50">
            {/* Search */}
            <AdminSearch />

            {/* Right Date and Action */}
            <div className="flex items-center gap-6">
              <ThemeSwitch size="sm" />
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Today</span>
                <span className="text-sm font-medium text-foreground font-sans tracking-wide">{today}</span>
              </div>
              <Link href="/admin/proposals/new">
                <Button variant="secondary" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm px-4 font-medium text-[11px] h-8 tracking-wide border-none">
                  + New Proposal
                </Button>
              </Link>
              <Link href="/admin/assessments/new">
                <Button variant="secondary" className="bg-gold hover:bg-gold/90 text-gold-foreground rounded-sm px-4 font-medium text-[11px] h-8 tracking-wide border-none">
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

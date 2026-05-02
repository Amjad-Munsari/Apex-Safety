"use client";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";

export interface SidebarStats {
  clients: number;
  expiries: number;
  reports: number;
  compliance: number;
  proposals: number;
  errors: number;
}

const navItems = [
  { num: "01", label: "Clients",         href: "/admin/clients",       statsKey: "clients",    danger: false },
  { num: "02", label: "Expiries",        href: "/admin/expiries",      statsKey: "expiries",   danger: false },
  { num: "03", label: "Reports",         href: "/admin/review-queue",  statsKey: "reports",    danger: false },
  { num: "04", label: "Compliance",      href: "/admin/compliance",    statsKey: "compliance", danger: false },
  { num: "05", label: "Hours",           href: "/admin/hours",         statsKey: null,         danger: false },
  { num: "06", label: "Proposals",       href: "/admin/proposals",     statsKey: "proposals",  danger: false },
  { num: "07", label: "Workflow Errors", href: "/admin/errors",        statsKey: "errors",     danger: true  },
  { num: "08", label: "Month Summary",   href: "/admin/month-summary", statsKey: null,         danger: false },
] as const;

export function AppSidebar({ stats }: { stats?: SidebarStats }) {
  const pathname = usePathname();

  return (
    <Sidebar className="border-none bg-black">
      <SidebarHeader className="pt-10 px-8 pb-8 border-b border-white/5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-mono mb-2 opacity-50">Practice</span>
          <h1 className="font-serif text-[28px] leading-[0.9] text-white font-medium tracking-tight">
            888 Safety<br />
            &amp; Training.
          </h1>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-5 py-8">
        <SidebarMenu className="gap-2">
          {/* Dashboard — active only at exact /admin */}
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/admin"}
              className="h-11 text-white bg-white/10 hover:bg-white/15 relative rounded-[4px] border border-white/5 shadow-sm mb-4 data-[active=true]:bg-white/10 data-[active=true]:text-white"
              render={(props) => (
                <Link {...props} href="/admin" className="flex w-full items-center px-3">
                  <span className="text-white/40 font-mono tracking-widest w-5 mr-3">-</span>
                  <span className="font-medium tracking-wide text-sm">Dashboard Overview</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const count = item.statsKey ? (stats?.[item.statsKey] ?? null) : null;
            const showDanger = item.danger && count !== null && count > 0;

            return (
              <SidebarMenuItem key={item.num}>
                <SidebarMenuButton
                  isActive={isActive}
                  className="h-11 text-white/50 hover:text-white/95 hover:bg-white/[0.06] transition-colors duration-150 rounded-[4px] data-[active=true]:text-white data-[active=true]:bg-white/10 data-[active=true]:border data-[active=true]:border-white/5"
                  render={(props) => (
                    <Link {...props} href={item.href} className="flex w-full items-center px-3">
                      <span className="text-white/30 font-mono text-[11px] w-5 mr-4">{item.num}</span>
                      <span className="text-sm tracking-wide">{item.label}</span>
                      {count !== null && (
                        <span className={`ml-auto text-[10px] font-mono border px-1.5 py-0.5 rounded-[3px] ${
                          showDanger
                            ? "text-danger border-danger/20"
                            : "text-white/30 border-white/10"
                        }`}>
                          {count}
                        </span>
                      )}
                    </Link>
                  )}
                />
              </SidebarMenuItem>
            );
          })}

          {/* System Tools */}
          <div className="mt-8 pt-8 border-t border-white/5 flex flex-col gap-2">
            <span className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-2">System Tools</span>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/admin/templates")}
                className="h-11 text-white/50 hover:text-white/95 hover:bg-white/[0.06] transition-colors duration-150 rounded-[4px] data-[active=true]:text-white data-[active=true]:bg-white/10"
                render={(props) => (
                  <Link {...props} href="/admin/templates" className="flex w-full items-center px-3">
                    <span className="text-white/30 font-mono text-[11px] w-5 mr-4">&gt;</span>
                    <span className="text-sm tracking-wide">Form Templates</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/admin/services")}
                className="h-11 text-white/50 hover:text-white/95 hover:bg-white/[0.06] transition-colors duration-150 rounded-[4px] data-[active=true]:text-white data-[active=true]:bg-white/10"
                render={(props) => (
                  <Link {...props} href="/admin/services" className="flex w-full items-center px-3">
                    <span className="text-white/30 font-mono text-[11px] w-5 mr-4">&gt;</span>
                    <span className="text-sm tracking-wide">Service Catalog</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/admin/notifications")}
                className="h-11 text-white/50 hover:text-white/95 hover:bg-white/[0.06] transition-colors duration-150 rounded-[4px] data-[active=true]:text-white data-[active=true]:bg-white/10"
                render={(props) => (
                  <Link {...props} href="/admin/notifications" className="flex w-full items-center px-3">
                    <span className="text-white/30 font-mono text-[11px] w-5 mr-4">&gt;</span>
                    <span className="text-sm tracking-wide">Notifications</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname.startsWith("/admin/settings")}
                className="h-11 text-white/50 hover:text-white/95 hover:bg-white/[0.06] transition-colors duration-150 rounded-[4px] data-[active=true]:text-white data-[active=true]:bg-white/10"
                render={(props) => (
                  <Link {...props} href="/admin/settings" className="flex w-full items-center px-3">
                    <span className="text-white/30 font-mono text-[11px] w-5 mr-4">&gt;</span>
                    <span className="text-sm tracking-wide">Settings</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>

          </div>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-8 border-t border-white/5">
        <div className="flex flex-col gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
            <span className="text-white font-semibold tracking-wide">Matt Robinson</span>
          </div>
          <span className="text-white/40">matt@888safetyandtraining.com</span>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="text-white/30 hover:text-white/60 transition-colors text-[10px] uppercase tracking-[0.15em]">
              Sign out
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

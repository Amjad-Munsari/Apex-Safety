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

type NavItem = {
  label: string;
  href: string;
  statsKey: keyof SidebarStats | null;
  exact?: boolean;
};

const mainNav: NavItem[] = [
  { label: "Dashboard",  href: "/admin",            statsKey: "reports",   exact: true },
  { label: "Clients",    href: "/admin/clients",    statsKey: "clients" },
  { label: "Compliance", href: "/admin/compliance", statsKey: "expiries" },
  { label: "Expiries",   href: "/admin/expiries",   statsKey: "expiries" },
  { label: "Proposals",  href: "/admin/proposals",  statsKey: "proposals" },
];

const systemTools: NavItem[] = [
  { label: "Form Templates", href: "/admin/templates",      statsKey: null },
  { label: "Service Catalog", href: "/admin/services",      statsKey: null },
  { label: "Notifications",   href: "/admin/notifications", statsKey: null },
  { label: "Settings",        href: "/admin/settings",      statsKey: null },
];

const linkClass =
  "flex w-full items-center pl-3 pr-3 h-10 rounded-[4px] " +
  "text-sm tracking-wide font-medium " +
  "border-l-2 border-transparent " +
  "text-white/55 hover:text-white hover:bg-white/5 transition-colors duration-150 " +
  "data-[active]:text-white data-[active]:bg-white/10 data-[active]:border-gold";

export function AppSidebar({ stats }: { stats?: SidebarStats }) {
  const pathname = usePathname();

  const isItemActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

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
        <SidebarMenu className="gap-1">
          {mainNav.map((item) => {
            const active = isItemActive(item);
            const count = item.statsKey ? (stats?.[item.statsKey] ?? null) : null;
            const showCount = count !== null && count > 0;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  className="p-0 h-auto"
                  render={(props) => (
                    <Link {...props} href={item.href} className={linkClass}>
                      <span>{item.label}</span>
                      {showCount && (
                        <span className="ml-auto text-[10px] font-mono text-white/40">
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
          <div className="mt-8 pt-8 border-t border-white/5 flex flex-col gap-1">
            <span className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-3">System Tools</span>
            {systemTools.map((item) => {
              const active = isItemActive(item);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={active}
                    className="p-0 h-auto"
                    render={(props) => (
                      <Link {...props} href={item.href} className={linkClass}>
                        <span>{item.label}</span>
                      </Link>
                    )}
                  />
                </SidebarMenuItem>
              );
            })}
          </div>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-8 border-t border-white/5">
        <div className="flex flex-col gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
            <span className="text-white font-semibold tracking-wide">Matt Robinson</span>
          </div>
          <span className="text-white/40">888FST@proton.me</span>
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

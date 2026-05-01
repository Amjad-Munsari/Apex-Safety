"use client";
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

export function AppSidebar() {
  return (
    <Sidebar className="border-none bg-black">
      <SidebarHeader className="pt-10 px-8 pb-8 border-b border-white/5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-mono mb-2 opacity-50">Practice</span>
          <h1 className="font-serif text-[28px] leading-[0.9] text-white font-medium tracking-tight">
            Dineen Fire<br />
            &amp; Safety.
          </h1>
          <span className="text-[11px] text-muted-foreground mt-4 font-mono tracking-wider opacity-60 italic">Solo practice &middot; Est. 2019</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-5 py-8">
        <SidebarMenu className="gap-4">
          {/* Active Dashboard */}
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive
              className="h-11 text-white bg-white/10 hover:bg-white/15 relative rounded-[4px] border border-white/5 shadow-sm"
              render={(props) => (
                <Link {...props} href="/admin" className="flex w-full items-center px-3">
                  <span className="text-white/40 font-mono tracking-widest w-5 mr-3">-</span>
                  <span className="font-medium tracking-wide text-sm">Dashboard</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          {/* Other Links */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-11 text-white/50 hover:text-white hover:bg-white/[0.03] transition-all rounded-[4px]"
              render={(props) => (
                <Link {...props} href="/admin/clients" className="flex w-full items-center px-3">
                  <span className="text-white/30 font-mono text-[11px] w-5 mr-4">01</span>
                  <span className="text-sm tracking-wide">Clients</span>
                  <span className="ml-auto text-[10px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded-[3px]">8</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-11 text-white/50 hover:text-white hover:bg-white/[0.03] transition-all rounded-[4px]"
              render={(props) => (
                <Link {...props} href="#" className="flex w-full items-center px-3">
                  <span className="text-white/30 font-mono text-[11px] w-5 mr-4">02</span>
                  <span className="text-sm tracking-wide">Assessments</span>
                  <span className="ml-auto text-[10px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded-[3px]">34</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-11 text-white/50 hover:text-white hover:bg-white/[0.03] transition-all rounded-[4px]"
              render={(props) => (
                <Link {...props} href="#" className="flex w-full items-center px-3">
                  <span className="text-white/30 font-mono text-[11px] w-5 mr-4">03</span>
                  <span className="text-sm tracking-wide">Documents</span>
                  <span className="ml-auto text-[10px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded-[3px]">142</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-11 text-white/50 hover:text-white hover:bg-white/[0.03] transition-all rounded-[4px]"
              render={(props) => (
                <Link {...props} href="#" className="flex w-full items-center px-3">
                  <span className="text-white/30 font-mono text-[11px] w-5 mr-4">04</span>
                  <span className="text-sm tracking-wide">Proposals</span>
                  <span className="ml-auto text-[10px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded-[3px]">4</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-11 text-white/50 hover:text-white hover:bg-white/[0.03] transition-all rounded-[4px]"
              render={(props) => (
                <Link {...props} href="#" className="flex w-full items-center px-3">
                  <span className="text-white/30 font-mono text-[11px] w-5 mr-4">05</span>
                  <span className="text-sm tracking-wide">Hours</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-11 text-white/50 hover:text-white hover:bg-white/[0.03] transition-all rounded-[4px]"
              render={(props) => (
                <Link {...props} href="#" className="flex w-full items-center px-3">
                  <span className="text-white/30 font-mono text-[11px] w-5 mr-4">06</span>
                  <span className="text-sm tracking-wide">Workflow errors</span>
                  <span className="ml-auto text-[10px] font-mono text-danger border border-danger/20 px-1.5 py-0.5 rounded-[3px]">3</span>
                </Link>
              )}
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-11 text-white/50 hover:text-white hover:bg-white/[0.03] transition-all rounded-[4px]"
              render={(props) => (
                <Link {...props} href="/admin/templates" className="flex w-full items-center px-3">
                  <span className="text-white/30 font-mono text-[11px] w-5 mr-4">07</span>
                  <span className="text-sm tracking-wide">Templates</span>
                </Link>
              )}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-8 border-t border-white/5">
        <div className="flex flex-col gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
            <span className="text-white font-semibold tracking-wide">Matt Dineen</span>
          </div>
          <span className="text-white/40">matt@dineen-fire.co.uk</span>
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

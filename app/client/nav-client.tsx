"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { id: "01", label: "Dashboard", href: "/client" },
  { id: "02", label: "Compliance", href: "/client/compliance" },
  { id: "03", label: "Reports", href: "/client/reports" },
  { id: "04", label: "Billing", href: "/client/billing" },
  { id: "05", label: "Assessments", href: "/client/assessments" },
  { id: "06", label: "Templates", href: "/client/templates" },
  { id: "07", label: "Proposals", href: "/client/proposals" },
  { id: "08", label: "Contracts", href: "/client/contracts" },
] as const;

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/client") return pathname === "/client";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface ClientIdentity {
  orgName: string;
  userName: string;
  userRole: string;
  clientRef: string;
}

export function ClientNav({ identity }: { identity: ClientIdentity }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-[#e5e1d8]">
      <div className="max-w-[1320px] mx-auto h-16 lg:h-20 px-4 lg:px-6 xl:px-8 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-6 lg:gap-8 min-w-0">
          <Link href="/client" className="flex flex-col gap-0.5 min-w-0 shrink-0">
            <span className="hidden lg:inline font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase whitespace-nowrap">
              {identity.clientRef} &middot; Compliance Portal
            </span>
            <span className="font-serif text-[15px] lg:text-[17px] text-[#1a1a1a] font-medium tracking-tight whitespace-nowrap truncate max-w-[180px] lg:max-w-[260px]">
              {identity.orgName}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-3 lg:gap-5 xl:gap-6 min-w-0">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 group transition-all whitespace-nowrap shrink-0",
                    active ? "text-black" : "text-[#6b6560] hover:text-black"
                  )}
                >
                  <span
                    className={cn(
                      "hidden xl:inline font-mono text-[9px] tracking-[0.2em] transition-colors",
                      active ? "text-black" : "text-[#8a857f] group-hover:text-black"
                    )}
                  >
                    {item.id}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] lg:text-[12px] font-bold tracking-tight border-b-2 transition-all capitalize",
                      active ? "border-black pb-0.5" : "border-transparent pb-0 hover:border-[#ddd]"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3 lg:gap-5 shrink-0">
          <div className="hidden xl:flex flex-col items-end leading-tight">
            <span className="text-[12px] font-bold tracking-tight text-[#1a1a1a] whitespace-nowrap">
              {identity.userName}
            </span>
            <span className="text-[8px] uppercase font-mono tracking-[0.2em] text-[#8a857f] mt-0.5 whitespace-nowrap">
              {identity.userRole}
            </span>
          </div>
          <form action="/auth/signout" method="POST" className="hidden md:block">
            <Button
              type="submit"
              variant="outline"
              className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[10px] uppercase tracking-[0.2em] h-8 lg:h-9 px-4 font-bold shadow-none transition-all whitespace-nowrap"
            >
              Sign out
            </Button>
          </form>

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="outline"
                  size="icon"
                  className="md:hidden rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] h-9 w-9 shadow-none"
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              )}
            />
            <SheetContent side="right" className="bg-white text-[#1a1a1a] p-0">
              <div className="px-6 pt-6 pb-4 border-b border-[#e5e1d8]">
                <div className="font-mono text-[8.5px] tracking-[0.25em] text-[#8a857f] uppercase">
                  {identity.clientRef} &middot; Compliance Portal
                </div>
                <div className="font-serif text-[18px] mt-0.5">{identity.orgName}</div>
                <div className="mt-3 text-[12px] font-bold">{identity.userName}</div>
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8a857f]">
                  {identity.userRole}
                </div>
              </div>
              <nav className="flex flex-col py-4">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "px-6 py-3 flex items-center gap-3 transition-colors",
                        active ? "text-black bg-[#faf9f6]" : "text-[#6b6560] hover:text-black hover:bg-[#faf9f6]"
                      )}
                    >
                      <span
                        className={cn(
                          "font-mono text-[9px] tracking-[0.2em]",
                          active ? "text-black" : "text-[#8a857f]"
                        )}
                      >
                        {item.id}
                      </span>
                      <span className="text-[13px] font-bold tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <form action="/auth/signout" method="POST" className="px-6 pt-2 pb-6 mt-auto border-t border-[#e5e1d8]">
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[10px] uppercase tracking-[0.2em] h-10 font-bold shadow-none"
                >
                  Sign out
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

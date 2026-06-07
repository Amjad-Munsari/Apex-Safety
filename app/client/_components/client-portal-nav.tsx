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

interface NavChild {
  label: string;
  href: string;
}
interface NavGroup {
  label: string;
  /** Where the top-level group link points (its default sub-page). */
  href: string;
  children?: NavChild[];
}

// Consolidated 4-group IA. Routes are unchanged — groups simply gather the
// existing pages and surface them via the secondary tab strip below the header.
const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", href: "/client" },
  {
    label: "Documents",
    href: "/client/compliance",
    children: [
      { label: "Compliance", href: "/client/compliance" },
      { label: "Reports", href: "/client/reports" },
    ],
  },
  {
    label: "Forms",
    href: "/client/assignments",
    children: [
      { label: "Assessments", href: "/client/assignments" },
      { label: "Templates", href: "/client/templates" },
    ],
  },
  {
    label: "Agreements",
    href: "/client/proposals",
    children: [
      { label: "Proposals", href: "/client/proposals" },
      { label: "Contracts", href: "/client/contracts" },
    ],
  },
  { label: "Billing", href: "/client/billing" },
];

function hrefActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/client") return pathname === "/client";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupActive(group: NavGroup, pathname: string | null): boolean {
  if (!pathname) return false;
  const hrefs = group.children ? group.children.map((c) => c.href) : [group.href];
  return hrefs.some((h) =>
    h === "/client" ? pathname === "/client" : pathname === h || pathname.startsWith(`${h}/`)
  );
}

interface ClientPortalNavProps {
  orgName: string;
  userName: string;
  userRole: string;
}

export function ClientPortalNav({ orgName, userName, userRole }: ClientPortalNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeGroup = NAV_GROUPS.find((g) => groupActive(g, pathname));
  const subItems = activeGroup?.children;

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-[#e5e1d8]">
      {/* Primary row — brand (left) · nav (center) · user (right) */}
      <div className="max-w-[1320px] mx-auto h-16 lg:h-20 px-4 lg:px-6 xl:px-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Brand (left) */}
        <Link href="/client" className="flex flex-col gap-0.5 min-w-0 shrink-0 justify-self-start">
          <span className="font-serif text-[15px] lg:text-[18px] text-[#1a1a1a] font-medium tracking-tight whitespace-nowrap truncate max-w-[200px] lg:max-w-[280px]">
            {orgName}
          </span>
        </Link>

        {/* Desktop group nav — centered */}
        <nav className="hidden md:flex items-center justify-center gap-7 lg:gap-9">
          {NAV_GROUPS.map((group) => {
            const active = groupActive(group, pathname);
            return (
              <Link
                key={group.label}
                href={group.href}
                className={cn(
                  "text-[13px] lg:text-[14px] font-bold tracking-tight whitespace-nowrap border-b-2 pb-1 transition-all",
                  active
                    ? "text-black border-black"
                    : "text-[#6b6560] border-transparent hover:text-black hover:border-[#ddd]"
                )}
              >
                {group.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side — pinned to column 3 so it stays right-aligned even when
            the center nav is hidden on mobile (a display:none grid item is
            removed from flow, which would otherwise auto-place this in column 2). */}
        <div className="flex items-center gap-4 lg:gap-6 shrink-0 col-start-3 justify-self-end">
          <div className="hidden lg:flex flex-col items-end leading-tight">
            <span className="text-[12px] font-bold tracking-tight text-[#1a1a1a] whitespace-nowrap">
              {userName}
            </span>
            <span className="text-[8px] uppercase font-mono tracking-[0.2em] text-[#8a857f] mt-0.5 whitespace-nowrap">
              {userRole}
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
                <div className="font-serif text-[18px] mt-0.5">{orgName}</div>
                <div className="mt-3 text-[12px] font-bold">{userName}</div>
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8a857f]">
                  {userRole}
                </div>
              </div>
              <nav className="flex flex-col py-3">
                {NAV_GROUPS.map((group) => {
                  const groupIsActive = groupActive(group, pathname);
                  return (
                    <div key={group.label} className="py-1">
                      <Link
                        href={group.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "px-6 py-2 block text-[14px] font-bold tracking-tight transition-colors",
                          groupIsActive ? "text-black" : "text-[#1a1a1a] hover:text-black"
                        )}
                      >
                        {group.label}
                      </Link>
                      {group.children && (
                        <div className="flex flex-col">
                          {group.children.map((child) => {
                            const childActive = hrefActive(child.href, pathname);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "pl-10 pr-6 py-2 text-[13px] transition-colors",
                                  childActive
                                    ? "text-black font-semibold bg-[#faf9f6]"
                                    : "text-[#6b6560] hover:text-black hover:bg-[#faf9f6]"
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
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

      {/* Secondary row — sub-nav tabs for the active group (desktop) */}
      {subItems && subItems.length > 0 && (
        <div className="hidden md:block border-t border-[#efece5] bg-white/50">
          <div className="max-w-[1320px] mx-auto px-4 lg:px-6 xl:px-8 h-11 flex items-center justify-center gap-7">
            {subItems.map((child) => {
              const childActive = hrefActive(child.href, pathname);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.2em] border-b-2 pb-0.5 transition-all whitespace-nowrap",
                    childActive
                      ? "text-black border-black"
                      : "text-[#8a857f] border-transparent hover:text-black"
                  )}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search, Phone, Mail, ExternalLink, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { groupByCategory, type Contractor, type ContractorCategory } from "@/lib/data/contractors";

interface Props {
  contractors: Contractor[];
}

const ALL = "All";

export function DirectoryBrowser({ contractors }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ContractorCategory | typeof ALL>(ALL);

  // Categories that actually have contractors, in canonical order, with counts.
  const categories = useMemo(
    () => groupByCategory(contractors).map((g) => ({ title: g.title, count: g.contractors.length })),
    [contractors]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contractors.filter((c) => {
      if (category !== ALL && c.category !== category) return false;
      if (!q) return true;
      return (
        c.company_name.toLowerCase().includes(q) ||
        c.contact_name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [contractors, query, category]);

  const hasFilters = query.trim().length > 0 || category !== ALL;

  function clearFilters() {
    setQuery("");
    setCategory(ALL);
  }

  // Empty state (a): the directory itself has nothing — hide all search UI.
  if (contractors.length === 0) {
    return (
      <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
        <p className="font-serif text-[20px] text-foreground mb-3">No approved contractors yet.</p>
        <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
          Your consultant is building this list — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by company, contact, or trade…"
          aria-label="Search contractors"
          className="h-11 pl-10 pr-3 text-[14px] rounded-sm"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap items-center gap-2">
        <CategoryPill
          label={ALL}
          count={contractors.length}
          active={category === ALL}
          onClick={() => setCategory(ALL)}
        />
        {categories.map((c) => (
          <CategoryPill
            key={c.title}
            label={c.title}
            count={c.count}
            active={category === c.title}
            onClick={() => setCategory(c.title)}
          />
        ))}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "contractor" : "contractors"}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="font-mono text-[9px] tracking-[0.25em] uppercase text-teal hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
          <p className="font-serif text-[20px] text-foreground mb-3">
            {query.trim() ? `No matches for “${query.trim()}”.` : "No matches."}
          </p>
          <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed mb-6">
            Try a different search or trade category.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="font-mono text-[10px] tracking-[0.2em] uppercase font-bold text-foreground border border-border rounded-sm px-4 py-2 hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <ContractorCard key={c.id} contractor={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "font-mono text-[10px] tracking-[0.15em] uppercase font-medium rounded-sm border px-3 py-1.5 transition-colors flex items-center gap-1.5 whitespace-nowrap",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", active ? "opacity-70" : "opacity-50")}>{count}</span>
    </button>
  );
}

function ContractorCard({ contractor: c }: { contractor: Contractor }) {
  return (
    <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-6 flex flex-col gap-4 hover:bg-muted/30 transition-colors">
      {/* Header */}
      <div className="space-y-1.5">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-teal font-medium">
          {c.category}
        </span>
        <h4 className="font-serif text-[20px] text-foreground tracking-tight leading-tight">
          {c.company_name}
        </h4>
        <p className="font-sans text-[12px] text-muted-foreground">{c.contact_name}</p>
      </div>

      {/* Contact lines */}
      <div className="flex flex-col gap-2 text-[13px]">
        <a
          href={`tel:${c.phone.replace(/\s+/g, "")}`}
          className="flex items-center gap-2.5 text-foreground hover:text-teal transition-colors group"
        >
          <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-teal transition-colors shrink-0" />
          <span className="font-mono text-[12px] tracking-tight">{c.phone}</span>
        </a>
        <a
          href={`mailto:${c.email}`}
          className="flex items-center gap-2.5 text-foreground hover:text-teal transition-colors group min-w-0"
        >
          <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-teal transition-colors shrink-0" />
          <span className="truncate">{c.email}</span>
        </a>
        {c.website && (
          <a
            href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-foreground hover:text-teal transition-colors group min-w-0"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-teal transition-colors shrink-0" />
            <span className="truncate">{prettyUrl(c.website)}</span>
          </a>
        )}
        {c.address && (
          <div className="flex items-start gap-2.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="text-[12px] leading-relaxed">{c.address}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {c.notes && (
        <p className="font-sans text-[12px] text-muted-foreground leading-relaxed border-t border-border pt-3">
          {c.notes}
        </p>
      )}
    </div>
  );
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

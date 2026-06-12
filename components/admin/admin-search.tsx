"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Loader2, Building, FileText, X, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"

export function AdminSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const cacheRef = useRef<Map<string, any[]>>(new Map())

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      return
    }

    // Return cached result immediately without a network request
    if (cacheRef.current.has(debouncedQuery)) {
      setResults(cacheRef.current.get(debouncedQuery)!)
      setOpen(true)
      return
    }

    const controller = new AbortController()

    async function search() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal }
        )
        const data = await res.json()
        cacheRef.current.set(debouncedQuery, data)
        setResults(data)
        setOpen(true)
      } catch (error) {
        if ((error as any)?.name === "AbortError") return
        console.error("Search failed:", error)
      } finally {
        setLoading(false)
      }
    }

    search()

    return () => {
      controller.abort()
    }
  }, [debouncedQuery])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        containerRef.current?.querySelector("input")?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  function handleSelect(url: string) {
    router.push(url)
    setOpen(false)
    setQuery("")
  }

  return (
    <div className="relative w-96 group" ref={containerRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground/70 transition-colors" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value.length >= 2) setOpen(true)
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true)
        }}
        placeholder="Search clients, documents..."
        className="w-full bg-transparent border border-border rounded-sm py-2 pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-border/60 transition-colors"
      />

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : query ? (
          <button onClick={() => setQuery("")} className="hover:text-foreground transition-colors">
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : (
          <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        )}
      </div>

      {/* Results Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-sm shadow-2xl overflow-hidden z-50 py-2">
          <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest border-b border-border mb-1">
            Search Results
          </div>
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result.url)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left transition-colors group"
            >
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                {result.type === "client" ? (
                  <Building className="w-4 h-4 text-foreground/60" />
                ) : result.type === "proposal" ? (
                  <Send className="w-4 h-4 text-foreground/60" />
                ) : (
                  <FileText className="w-4 h-4 text-foreground/60" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground/90 truncate">{result.title}</span>
                {result.subtitle && (
                  <span className="text-[10px] text-muted-foreground truncate">{result.subtitle}</span>
                )}
              </div>
              <span className="ml-auto text-[9px] font-mono uppercase text-muted-foreground tracking-widest px-1.5 py-0.5 border border-border rounded">
                {result.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-sm shadow-2xl z-50 p-8 text-center">
          <span className="text-sm text-muted-foreground italic">No matches found for "{query}"</span>
        </div>
      )}
    </div>
  )
}

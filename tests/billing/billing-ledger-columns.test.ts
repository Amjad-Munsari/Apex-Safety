import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Guards against phantom columns on the billing ledger query. The client
// Billing page 42703'd in production (July 2026) because it filtered
// hours_transactions.deleted_at — a column migration 001 declares but the live
// database never got. lib/supabase/database.types.ts is generated from
// production, so it is the column set queries must be checked against;
// migration files are not trustworthy (see the note atop 001_initial_schema.sql).

const billingSource = readFileSync("app/client/billing/page.tsx", "utf8")
const typesSource = readFileSync("lib/supabase/database.types.ts", "utf8")

/** Column names of a table's Row type in the generated database types. */
function generatedColumns(table: string): Set<string> {
  const block = typesSource.match(
    new RegExp(`${table}: \\{\\s*Row: \\{([\\s\\S]*?)\\}`)
  )
  if (!block) throw new Error(`table ${table} missing from database.types.ts`)
  const cols = new Set<string>()
  for (const m of block[1].matchAll(/^\s*(\w+)\??:/gm)) cols.add(m[1])
  return cols
}

/** The full builder chain starting at .from("<table>") — subsequent chained
 * lines until the first line that is not part of the chain. Comment lines are
 * skipped over but excluded, so prose mentioning old filters can't trip the
 * assertions below. */
function builderChain(source: string, table: string): string {
  const start = source.indexOf(`.from("${table}")`)
  if (start === -1) throw new Error(`no .from("${table}") in source`)
  const lines = source.slice(start).split("\n")
  const chain: string[] = [lines[0]]
  for (const line of lines.slice(1)) {
    const t = line.trim()
    if (t.startsWith("//")) continue
    if (t.startsWith(".")) chain.push(line)
    else break
  }
  return chain.join("\n")
}

describe("billing ledger column safety", () => {
  const chain = builderChain(billingSource, "hours_transactions")
  const columns = generatedColumns("hours_transactions")

  it("only selects columns that exist in production", () => {
    const select = chain.match(/\.select\("([^"]+)"\)/)
    expect(select, "ledger query should have a .select()").toBeTruthy()
    for (const col of select![1].split(",").map((c) => c.trim())) {
      expect(columns, `selected column "${col}"`).toContain(col)
    }
  })

  it("only filters and orders on columns that exist in production", () => {
    for (const m of chain.matchAll(/\.(?:eq|neq|is|not|gt|gte|lt|lte|order)\("(\w+)"/g)) {
      expect(columns, `filtered column "${m[1]}"`).toContain(m[1])
    }
  })

  it("does not resurrect the phantom deleted_at filter", () => {
    expect(columns.has("deleted_at")).toBe(false)
    expect(chain).not.toContain('"deleted_at"')
  })
})

# Design System — 888 Safety / Dineen Fire & Safety

Editorial operator tooling. Two surfaces share one design language with inverted themes.

## Direction

**"Editorial operations."** Two-surface system that keeps a serif/eyebrow/numbered-section vocabulary across both modes:

- **Admin (operator)** — dark theme. Cockpit. Gold accent. For Matt running the practice.
- **Client (end-customer)** — cream theme. Document room. Black filled CTAs. For facility managers receiving outputs.

Common spine: serif display + sans body, mono uppercase eyebrows, numbered sections (`01`, `02`, `03`), big numerals as headlines, ringed (not bordered) cards, RAG status pills.

Reference points: FT Pro / Stripe Atlas docs / a serif-led admin console. Not Linear, not generic shadcn.

## Foundation

### Color (OKLCH)

Defined in `app/globals.css`. The dark `:root` is the **admin theme**; the light variants render in client surfaces (light surface is currently expressed via custom cream backgrounds + inverted button colors at the page level — the codebase has a `:root` light token set but the body force-paints `#111111`, so the client routes opt in explicitly).

| Token | Admin (dark) | Use |
|---|---|---|
| `--background` / body paint | `#111111` (forced) | Admin shell |
| `--card` / `--popover` | `oklch(0.20 0.005 260)` | Cards, dialogs (admin) |
| `--foreground` | `oklch(0.85 0 0)` | Body text |
| `--muted-foreground` | `oklch(0.65 0 0)` | Eyebrows, captions |
| `--primary` | `oklch(0.95 0 0)` | White-on-dark (used as default button bg in admin) |
| `--gold` | `oklch(0.74 0.15 65)` | **Primary CTA accent** in admin (`+ New Assessment`, "Continue →", spinner) |
| `--success` | `oklch(0.65 0.15 150)` | RAG green dot, "CURRENT" |
| `--danger` | `oklch(0.60 0.16 20)` | "EXPIRED", error UI, alert dots |
| `--border` / `--input` | `oklch(1 0 0 / 10%)` | Subtle hairlines |
| `--ring` | `oklch(0.56 0.021 213.5)` | Focus halo |

**Client (cream) theme** (observed in browser; not yet tokenised — currently page-level styling):
- Surface: warm off-white (~`#FAF8F3`)
- Primary CTA: black/near-black filled (`Start New Assessment`, `Buy More Hours`)
- RAG: muted earth — sage green / olive amber / brick red

> **TODO:** lift the cream theme into `globals.css` as a `.client` (or `[data-theme="client"]`) variant so its colors live as tokens, not hard-coded page styles.

### Typography

Pairing: **serif display + sans body + mono eyebrow**. The `@theme inline` block defines `--font-sans`, `--font-serif`, `--font-mono` though concrete font families are loaded at the layout level — the eyebrow look (mono, uppercase, tracked) is achieved with class composition, not a token.

| Role | Treatment | Example |
|---|---|---|
| Display H1 | Serif, regular weight, ~`text-3xl`–`text-5xl` | "Welcome back, Matt." / "Good morning, Sarah." |
| Eyebrow | Mono/sans, **uppercase**, tracked, `text-xs`, muted-foreground | `01 SINGLE PANE OF GLASS`, `EMAIL ADDRESS`, `PRACTICE` |
| Body | Sans, `text-xs/relaxed` (default) or `text-sm` | Most copy |
| Numerals (statline) | Serif, oversized, accent-colored | `4.5 hours` (italic), `9 / 2 / 2` ribbon |
| Caption | Sans, italic, muted | "Solo practice · Est. 2019" |
| Mono ID | Mono, uppercase | `CL-8A01`, `DOC-1408` |

**Used class density (from `app/**` + `components/**`):** `text-xs` (111×) ≫ `text-sm` (76×) ≫ `text-xs/relaxed` (28×). Headings (`text-3xl`+) appear <15× total. Most body is small; emphasis comes from **size jumps**, not weight.

### Spacing & rhythm

- Base: **4px** (Tailwind default).
- Top-used: `gap-2` (73), `gap-3` (64), `gap-4` (34), `px-6` (85), `py-4` (76), `px-4` (53).
- Page padding generous (`px-6`–`px-12`), but inside controls is **dense**.
- Section rhythm uses an **eyebrow + 8–16px gap + display heading** stack, repeated.

### Radius

`--radius: 10px` → `sm=6, md=8, lg=10, xl=14`. Real usage:

- `rounded-sm` (96×) — small chips, inline counters
- `rounded-md` — buttons, inputs (28px tall, so radius = ~21% of height — not pill-y)
- `rounded-lg` — cards (the workhorse)
- `rounded-xl` — dialogs (slightly softer than cards, signals modal lift)
- `rounded-full` (35×) — RAG pills, badges, search-bar `⌘K` chip

### Depth strategy: **rings, not shadows**

The signature move: cards and dialogs use `ring-1 ring-foreground/10` instead of `border`. This gives a subtle inner-glow edge that reads cleaner on dark surfaces than a hard 1px border.

- Card: `ring-1 ring-foreground/10` (no border)
- Dialog: `ring-1 ring-foreground/10` + `rounded-xl` + dim backdrop (`bg-black/80`) with optional `backdrop-blur-xs`
- Focus: `ring-2 ring-ring/30` + border swap
- Shadows: light usage — `shadow-none` (12) ≥ `shadow-sm` (11) > `shadow-md` (7). **Default to no shadow.**

### Motion

One named keyframe in `globals.css`:

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-in-fade { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
```

This curve (out-expo) is **the project's signature ease**. Use it for page entries and content reveals. Live demo: every admin route entry uses it (visible on `/admin/clients` reload).

Dialog entry uses `data-open:animate-in fade-in-0 zoom-in-95` (shadcn defaults). No bounce.

## Patterns

### Button

Implemented as `components/ui/button.tsx` (CVA). Compact by default — **28px tall**.

| Size | Height | Padding | Use |
|---|---|---|---|
| `xs` | 20px | px-2 | Inline counters |
| `sm` | 24px | px-2 | Toolbar, dialog footer secondary |
| **`default`** | **28px** | **px-2** | **Almost everywhere** |
| `lg` | 32px | px-2.5 | Hero CTAs |

**Variant decisions in the wild:**
- `default` (filled white-on-dark in admin) → primary CTA in admin chrome
- Custom **gold-filled** (`bg-gold text-foreground` composed at page level) → marquee actions like `+ New Assessment`, `Continue →`, `Start Assessment`
- `outline` → secondary actions, history/back, all chrome buttons in cream theme
- `ghost` → icon-only, dialog close, nav arrows
- `destructive` → uses **tinted bg** (`bg-destructive/10 text-destructive`) — never solid red. Matches the badge destructive variant.

**Label casing convention** (observed):
- **Sentence case** for create/start actions: `+ New Proposal`, `+ New Assessment`, `Start Assessment`, `Continue`
- **UPPERCASE** for navigational/utility actions: `VIEW ALL`, `VIEW QUEUE`, `BACK TO DASHBOARD`, `RETURN TO DASHBOARD`, `TRY AGAIN`, `SIGN OUT`, `REVIEW`, `HISTORY`, `BUY MORE HOURS`

### Card

`components/ui/card.tsx` — `rounded-lg`, `py-4` body, `px-4` slot, `gap-4` between slots, **`ring-1 ring-foreground/10`** (not a border), `bg-card`, `text-xs/relaxed`.

When sectioned in a page, the card opens with an internal eyebrow row:
```
01 Clients   [8 ACTIVE]                            VIEW ALL
─────────────────────────────────────────────────────────
[ table or content ]
```

The `[8 ACTIVE]` chip is a subtle pill (rounded-sm, low-contrast bg, mono). The `VIEW ALL` is an underlined uppercase link (no button chrome).

### Dialog

`components/ui/dialog.tsx` — `rounded-xl`, `p-4`, `ring-1 ring-foreground/10`, `max-w-sm` default, X close top-right, `gap-4` content stack.

**Wizard dialog pattern** (observed in `+ New Assessment`):
- Header: small uppercase eyebrow `STEP 1 OF 2` (muted)
- Title: serif, sentence case
- Body: vertically stacked selectable rows, each a ring-bordered button
- Selected state: **gold ring + gold text + small gold dot at right edge**
- Footer: ghost `← Back` left, gold filled action right

### Input

`components/ui/input.tsx` — 28px tall, `rounded-md`, `border-input`, `bg-input/20` (slight tint, not filled). Focus: `border-ring + ring-2 ring-ring/30`. Error: `border-destructive + ring-destructive/20`.

Page-level pattern:
```
EMAIL ADDRESS                    ← uppercase eyebrow label, NOT a sentence-case <label>
[ admin@test.com         ]
```

### Badge / status pill

`components/ui/badge.tsx` — h-5, `rounded-full`, `text-[0.625rem]`, uppercase. Variants:
- `default` (primary fill)
- `outline` (subtle bordered)
- `destructive` — **tinted background** `bg-destructive/10 text-destructive` (never solid)

**RAG pill pattern** (used everywhere status matters):
```
● CURRENT     ● EXPIRING     ● EXPIRED
(green)       (gold/amber)   (red)
```
Dot is a `size-1.5` circle in the same color as the text. Background is the tinted variant.

### Table

`components/ui/table.tsx` — `text-xs`, `h-10` head, `p-2` cells, `border-b` rows, `hover:bg-muted/50`. Column headers in **uppercase eyebrow** style.

### Top bar (admin)

```
[search …  ⌘K]              TODAY
                            Sun, 3 May 2026     [+ New Proposal]  [+ New Assessment]
```

Search is a 28px input with a leading magnifier icon and a trailing `⌘K` chip (the `kbd`-style pill).

### Sidebar (admin)

`components/app-sidebar.tsx` style:
- Eyebrow `PRACTICE`
- Brand serif (multiline if long): `Dineen Fire & Safety.`
- Caption: italic small `Solo practice · Est. 2019`
- Numbered nav: `01 Clients [0]` — number prefix is muted, count badge on the right
- Active item marked with a leading `-` and stronger contrast (no full pill background)
- Sub-section header `SYSTEM TOOLS` (uppercase eyebrow)
- Footer: `● Matt Dineen / matt@dineen-fire.co.uk` (status dot + name + email stacked)

### Top nav (client)

```
CL-8889 · COMPLIANCE PORTAL
Hallam House Care Home          01 Dashboard  02 Compliance  03 Reports …    Sarah Whitfield   [SIGN OUT]
                                                                              FACILITIES MANAGER
```

- Property identifier eyebrow + serif building name (left)
- Numbered horizontal nav with **underline-on-active** (no pill)
- User chip right: name (sentence) + role (uppercase eyebrow)
- `SIGN OUT` is uppercase-tracked outline button

### Page hero

Every primary page opens with this rhythm:

```
01 SECTION NAME                                   ← eyebrow (uppercase, mono, muted)
Big Serif Headline.                               ← display
Optional sub-line in body sans.                   ← caption
                                                  ← optional right-aligned CTA stack
```

The number in the eyebrow is repeated as the section number throughout the page, creating a numbered table of contents that scrolls with the user.

### KPI ribbon

Top-right of admin dashboard:

```
DRAFTS TO     OVERDUE     EXPIRING     WORKFLOW
REVIEW        DOCS        (30D)        ERRORS
0             0           0            0
```

4 columns, each = uppercase 2-line eyebrow + oversized colored numeral. Colors map to severity (gold = neutral, red = bad).

### Statline (client dashboard "Compliance Summary")

```
9         2          2
CURRENT   EXPIRING   EXPIRED
█████████████░░░░░░░░░░░░     ← segmented progress bar in the same RAG colors
13 compliance documents tracked
```

Big serif numerals, eyebrow underlabel, segmented bar that mirrors the same color scheme.

### Loading state

Centered: thin gold spinner ring + gold caption like `Initializing Assessment…`. Gold doubles as the **in-progress accent** in admin (matches the gold CTA).

### Empty state

Inside-card minimal text in muted uppercase: `NO CLIENTS FOUND`, `NO UPCOMING EXPIRIES`. No illustration, no CTA buried in the empty area — keep the page-level CTA above instead.

### Error UI

`app/admin/error.tsx` style:
- Centered ring-bordered circle icon (red `!` for fatal)
- Serif "Something went wrong"
- Mono body in muted color
- Two outline buttons in uppercase tracked: `RETURN TO DASHBOARD` + `TRY AGAIN`

### Alert card (client)

Inset row inside dashboard:
```
●  2 documents have expired.                     [REVIEW]
   Review what's due, renew directly, or message Matt.
```
- Small red dot + serif headline in red + body caption in muted
- Outline `REVIEW` button right-aligned
- Subtle red ring around the whole card

### Document row (client)

```
Fire Risk Assessment (Type 3) — Main Building    ISSUED       EXPIRES        ● EXPIRED   [v]  [ Download PDF ]
DOC-1408 — 4.2MB                                 22 Nov 2024  22 Nov 2025
```
Three-column: title-stack | metadata-stack (label/value pairs) | status pill | actions (chevron + download).

### Status dot indicator (chrome)

Bottom-left of admin: `● Matt Dineen` (green dot = online/operational). Same dot used in `● All systems operational` on the login screen and as the RAG pill leading dot. Single dot vocabulary across the system.

## Anti-patterns (don't do)

- **Don't use solid `destructive`** for buttons or pills — always the tinted `bg-destructive/10` variant. (Real `--destructive` solid red appears only as small accents like the red ring icon in error.tsx.)
- **Don't use shadows** to define cards. Use `ring-1 ring-foreground/10`. Shadows read as "gloss" against the matte editorial direction.
- **Don't use bordered cards.** The codebase uses `ring-1` instead — it composes better with the rounded-lg radius without a hairline-corner artifact.
- **Don't use sentence-case for utility/nav buttons.** UPPERCASE TRACKED is the convention for `VIEW ALL`, `BACK TO X`, `SIGN OUT`. Sentence case is reserved for create/start CTAs.
- **Don't introduce a third color accent** in the dark theme. Gold = action / in-progress. Red = bad. Green = good. Anything else dilutes the language.
- **Don't add nav-pill backgrounds.** Active state is **underline (client)** or **leading dash + contrast (admin)** — no rounded pill highlights.
- **Don't use `border-2`** anywhere. Hairlines are 1px (`border` / `ring-1`). Doubled borders break the editorial calm.

## File map

| Concern | Where |
|---|---|
| Tokens (color, radius, font vars) | `app/globals.css` |
| Component primitives | `components/ui/*` (shadcn `base-mira` style, baseColor `mist`) |
| Domain composites | `components/{assessments,forms}/*`, `app/{admin,client}/**` |
| shadcn config | `components.json` |

## Open questions

1. **Cream theme as a token set.** Currently the client surfaces opt out of the dark `:root` at the page level. Worth lifting into a `[data-theme="client"]` block in `globals.css` so the cream palette has named tokens (`--client-surface`, `--client-rag-current`, etc.) instead of inline values.
2. **Font family identity.** `--font-serif` / `--font-sans` / `--font-mono` are referenced but the actual face is configured at the layout level — name the families here once locked, so future contributors don't pick the wrong serif.
3. **Eyebrow as a primitive.** The `mono uppercase tracked text-xs muted-foreground` pattern repeats everywhere. Worth a tiny `<Eyebrow>` or `text-eyebrow` utility class to enforce.
4. **Numbered-section helper.** `01 SINGLE PANE OF GLASS` + serif headline is a load-bearing pattern. Should be a `<SectionHero number="01" eyebrow="…" title="…" />` to stop drift.
5. **Wizard dialog primitive.** The `STEP X OF Y` + selectable rows + back/next footer is repeated. Worth extracting as a `<WizardDialog>` so the gold-selection-state stays consistent.

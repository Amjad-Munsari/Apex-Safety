# Phase 9 Context: Proposal Pipeline

## Domain Boundary
Generating a branded proposal PDF with calculated service costs and an AI-drafted Scope of Work.

## Decisions

### 1. Service List Management
- **Full Admin UI**: Matt needs a dedicated admin interface to manage the service catalog (add, edit, delete services and their prices). We will not rely on hardcoded seed data alone.

### 2. AI Drafting Scope
- **Custom Generation**: The AI (OpenAI via OpenRouter) will be used to write a custom, tailored "Scope of Work" paragraph based on the specific services Matt selects, rather than just filling in simple merge tags on a static template.

### 3. Pricing & Calculation
- **Simple Flat Rate**: For now, pricing logic will be hardcoded to a simple `Unit Price * Quantity` model. Complex tiered packages or bundle logic will be deferred.

### 4. PDF Layout & Styling
- **Editorial Design**: The generated PDF will adopt the "High-Fidelity Editorial" styling used in the Portal (Slate/Outfit/Newsreader fonts, modern spacing) instead of strictly mirroring the old Word document template.

## Code Context
- **Models**: `services`, `proposals` tables (schema already generated in `001_initial_schema.sql`).
- **Helpers**: PDF rendering will likely use `@react-pdf/renderer` on the server.
- **Routing**: `/admin/proposals` (list and creation flow) and `/admin/services` (service catalog management).

## Canonical Refs
- [ROADMAP.md](file:///c:/dev/Antigravity/888%20Safety/.planning/ROADMAP.md)
- [001_initial_schema.sql](file:///c:/dev/Antigravity/888%20Safety/supabase/migrations/001_initial_schema.sql)

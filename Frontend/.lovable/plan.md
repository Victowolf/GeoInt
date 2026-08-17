# GeoIntelligence & Procurement Platform — Build Plan

Frontend-only React app on the existing TanStack Start stack. All data is mocked. No backend, no API calls.

## Design System

Update `src/styles.css` tokens to the requested palette:
- `--background` #FFFFFF, secondary surface #F7F8FA
- `--border` #D9DEE5
- `--primary` #1E3A5F (Deep Navy), `--secondary` #56728A (Steel Blue)
- Semantic success/warning/danger tokens (green/orange/red)
- `--foreground` #2D3748
- Radius 10–12px, soft shadows, no gradients
- Typography: Inter via `<link>` in `__root.tsx`

Update `__root.tsx` head metadata (title "GeoIntelligence & Procurement Platform", matching description/og/twitter).

## Routing

Single page at `src/routes/index.tsx` (replace placeholder). Tab state is local; no URL routing needed. Fade transition between tabs via framer-motion `AnimatePresence`.

## Top Bar

Centered custom segmented control matching the reference image:
- Pill container with two segments: **GEOINT** | **CATALOGUE**
- Active segment: navy fill, white text, subtle inset shadow, checkmark-style indicator
- Inactive: transparent, steel-blue text
- Standalone square "+" button to the right with hover scale/shadow animation (no-op onClick)

Component: `src/components/TabSwitcher.tsx`

## TAB 1 — GEOINT

Layout: 65/35 split, full viewport height minus header.

### Left (65%) — Map
`src/components/GeointMap.tsx`
- Placeholder styled map: light grey world SVG background, mocked pins (dots with pulse), dashed polyline routes between pins, legend chip
- No real map library — pure SVG/CSS to stay frontend-only and lightweight

### Right (35%) — Scrollable panel with 4 cards
`src/components/geoint/*`

**Card 1 – Geopolitical Intelligence Agent**
- Sticky-header table (Destination, Present Status, URL "Link" → opens `https://example.com` in new tab)
- Risk Score: horizontal progress bar 0–100, color-coded (green <30, yellow <55, orange <80, red ≥80)

**Card 2 – Future Scenario Probability**
- Sticky-header table: Probability %, Scenario (blue link → dialog), Estimated Delays, Cost Impact (▲ red / ▼ green single arrow)
- Dialog shows Title, Description, Probability, Estimated Delays, Risk Summary (read-only formatted text)
- Nested **Supply Chain Analysis** subsection: 6 info cards (Stability, Bottlenecks, Mitigation, Recovery Time, Inventory Risk, Supplier Reliability)

**Card 3 – Route Optimization Agent**
- Table: Route (blue link → dialog with Summary, Est Cost, Est Time, Advantages, Disadvantages, Alternatives), Risk Score (colored badge)

**Card 4 – Decision Advisor**
- Large colored recommendation badge (randomly one of: Proceed=green, Caution=orange, Wait=red, Use Alternate Route=steel blue)
- Reason bullet list, Factors bullet list

All cards: rounded, soft shadow, white bg, collapsible via chevron toggle.

### GEOINT Popup — "Create Intelligence Request"
Auto-opens first time GEOINT tab is shown (tracked via `useState`, resets when switching away and back is fine — spec says "first time"; use a ref flag so it opens once per session).

`src/components/geoint/CreateRequestDialog.tsx`

Fields:
1. **Define Route** — `RouteChain` component. Horizontal flex row of route boxes. Each box: white bg, rounded, border, editable text input, focus ring. Between adjacent boxes render a small checkmark icon inside the divider between input and connector. After the final box, a connector line then a square "+" button that appends another box. Infinite. Matches uploaded reference.
2. **Preferred Transport** — Select (Waterways/Airways/Road/Rail/Mixed)
3. **Budget** — Row: number input + currency select (USD/EUR/GBP/INR/AED/JPY/CNY)
4. **Maximum Duration** — Row: number input + unit select (Days/Weeks/Months)
5. **Sector** — Checkbox group; if Others → show "Specify Sector" text input below
6. **Intent** — Checkbox group (Buy/Sell/Transport)

Footer: **Preview** (secondary) + **Submit** (primary). Both close the dialog and populate mock data into the right-side cards (data is already mocked, so effectively just close + optionally toast).

## TAB 2 — CATALOGUE

`src/components/catalogue/*`

**Space card** (top): Large centered white card, title "Space", subtitle "Coming Soon", inline satellite SVG illustration.

**Procurement Advisor card**:
- Commodity Name (text)
- Quantity (number) + Unit (dropdown: kg, gram, ton, litre, millilitre, gallon, barrel, piece, packet, container)
- Expected Price (number) + Currency (same 7 currencies)
- Large primary **Submit** button
- On submit, render a **Results card** below:
  - Alternate Markets (list)
  - Alternate Suppliers (list)
  - Cost Difference block: Previous Cost, Optimized Cost, Savings (green), Difference % (green if saving / red if higher). Mocked values.

## Shared Components

- shadcn primitives already present: Button, Dialog, Input, Select, Checkbox, Card, Table, Badge, Progress
- Add `framer-motion` for tab fade + dialog animation (verify present, install if needed)
- Utility: `getRiskColor(score)` for color coding

## Files to create/modify

```
src/styles.css                                  (palette tokens)
src/routes/__root.tsx                           (head meta + Inter font)
src/routes/index.tsx                            (page shell, tab state)
src/components/TabSwitcher.tsx
src/components/GeointMap.tsx
src/components/geoint/CreateRequestDialog.tsx
src/components/geoint/RouteChain.tsx
src/components/geoint/GeopoliticalCard.tsx
src/components/geoint/ScenarioCard.tsx
src/components/geoint/SupplyChainAnalysis.tsx
src/components/geoint/RouteOptimizationCard.tsx
src/components/geoint/DecisionAdvisorCard.tsx
src/components/catalogue/SpaceCard.tsx
src/components/catalogue/ProcurementAdvisor.tsx
src/lib/mock-data.ts                            (all mocked rows/dialogs)
```

## Out of scope
- No backend, no Lovable Cloud, no real map SDK, no real data
- No auth, no persistence
- No pagination (per spec)

Approve to build.
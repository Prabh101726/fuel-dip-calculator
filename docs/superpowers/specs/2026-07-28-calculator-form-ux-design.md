# Calculator Form UX — Design Spec

Date: 2026-07-28  
Product: Fuel Dip Calculator  
Status: Approved for implementation planning (Project 1 — form UX only)

## Purpose

Tighten the per-tank calculator form for drivers: fixed product-grade choices,
less clutter, Location after the delivery dips, and tab labels that show the
selected product.

**Out of scope:** PWA / offline (Project 2), Stripe, other field removals,
schema migrations.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Product list | Hardcoded constant (Approach A) |
| Product UI | Dropdown; optional empty “Select product…” |
| Compartment | Removed from UI; save as `null` |
| Location | Moved to end of After delivery section |
| Tab labels | Product if set → else `#chart` if tank picked → else `Tank N` |

## Product grades (exact)

1. E15 Reg  
2. E10 Reg  
3. P93  
4. P91  
5. PE10  
6. U94  
7. LSD Clear  
8. LSD Dyed  

Stored in existing `dip_calculations.product_grade` as text. No new table.

## UI layout (per `TankSlot`)

**Setup / tank section (top)**  
- Tank picker  
- Safe-fill %  
- Product grade `<select>` (new)  
- ~~Location~~ removed from here  
- ~~Compartment #~~ removed  

**Before delivery** — unchanged (#2, #4, results, warnings)

**After delivery**  
- #5 after dip + results #5–#7 + warnings  
- **Location label** (moved here)  

**Retain / signature** — unchanged  

## Tab bar (`CalculatorClient`)

Each slot reports selected product (and chart) up to the shell:

1. If `productGrade` non-empty → tab label = that string (e.g. `E15 Reg`)  
2. Else if chart selected → `#526`  
3. Else → `Tank 1` … `Tank 4`  

Clear / reset slot clears product → label falls back.

## Data / save

- `toInsertPayload`: `compartmentNo` always null from UI (or omit empty)  
- `productGrade` from dropdown value or null if unselected  
- `locationLabel` unchanged field, new position only  
- No migration  

## Files (expected)

- `lib/app-copy.ts` (or `lib/product-grades.ts`) — `PRODUCT_GRADES` constant + tests  
- `app/calculator/TankSlot.tsx` — form layout + select + report product  
- `app/calculator/CalculatorClient.tsx` — tab label priority  

## Testing

- Unit test locks the eight product strings  
- Manual: pick product → tab renames; clear → falls back; location only under After; no compartment field; save still works  

## Follow-up (not this pass)

Project 2: full offline PWA (install, cache charts, offline calc, save queue).

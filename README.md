# Fuel Dip Calculator

A tool for fuel delivery drivers that replaces the paper "Safe Discharge Sheet" and
a 327-page dip-chart PDF. Pick a tank type and safe-fill % (90% or 95%), enter a
dip reading, and instantly see the current volume and safe headroom. After
delivery, enter the closing dip to get delivered volume and a reconciliation
against the planned amount.

Built as a second product under SRV Freight Inc, separate from
[Detours](https://detours-app.com).

## Status

Design phase complete, implementation not started yet. See
[`docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md`](docs/superpowers/specs/2026-07-23-fuel-dip-calculator-design.md)
for the full design: data model, driver workflow, error handling, and testing
strategy.

## Stack

- [Next.js](https://nextjs.org) (TypeScript, App Router)
- [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security)
- [Vercel](https://vercel.com) for hosting
- GitHub Actions for CI (lint, type-check, unit tests)

## Setup

Not yet scaffolded — coming with the implementation plan.

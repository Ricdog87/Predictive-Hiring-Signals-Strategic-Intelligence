# Product Brief — RSG Predictive Hiring Radar

## Problem

Recruiting and GTM teams act on hiring signals **after** they've become public —
often when a role is already posted, a competitor is already in conversations,
or a budget is already approved. By then the strategic opportunity is gone.

The market produces dozens of weak signals per company per quarter that, in
combination, predict an imminent hiring window: funding, leadership changes,
tech-stack shifts, headcount drift, role-mix changes, office expansion. These
signals exist in public, but they are scattered, noisy, and not weighted.

## Product

The **Predictive Hiring Radar** is a strategic intelligence dashboard that
fuses these public signals into a single **Predictive Hiring Score (PHS)** per
company, and surfaces the underlying drivers so a human analyst can reason
about *why* a window is opening.

The MVP is a Next.js dashboard backed by mock data. It is intentionally
**read-only intelligence**: no outreach, no e-mail, no CRM writes. Those
capabilities live in adjacent RSG systems (Hermes, MiroFish) and will be
integrated later.

## Target users

- **Strategic recruiting leads** building proactive pipelines
- **Founders / GTM leads** scanning for partnerships, displacement, or
  competitive moves
- **Investors / corporate development** monitoring portfolios

## Jobs to be done

1. *"Show me companies likely to scale a specific function in the next 90
   days."*
2. *"Give me a defensible reason — drivers and recent signals — for why a
   company appears on the radar."*
3. *"Let me filter the radar by region, industry, signal type, and minimum
   confidence."*
4. *"Let me drill into a single company and see the underlying signal stream."*

## Non-goals (v1)

- No outbound: no e-mail, no sequencing, no calls
- No CRM (HubSpot, Salesforce) integration
- No live external API calls — mock dataset only
- No multi-tenant accounts, auth, or persistence

## Success criteria

- A user can scan the radar in <30 seconds and identify the top 3 critical
  signals
- Every score on the dashboard can be explained by 2–3 named drivers
- The scoring logic lives in **one** file (`lib/scoring.ts`) and is trivially
  swappable for a service-backed implementation
- The dashboard is lokal lauffähig (`npm run dev`) on a clean clone

## Design principles

- **Show your work** — never display a score without its drivers
- **Calm density** — dense data, low chrome, dark theme suited for long
  analyst sessions
- **Composable later** — every component is decoupled from data fetching so
  Hermes can replace `mockData.ts` without UI changes

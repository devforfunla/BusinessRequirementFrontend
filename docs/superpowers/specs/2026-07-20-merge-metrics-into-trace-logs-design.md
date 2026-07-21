# Design: Merge Metrics into Trace Logs

**Date:** 2026-07-20
**Status:** In Progress

---

## Summary

Merge the standalone Metrics page (`/metrics`) into the Trace Logs page (`/trace-logs`). After searching a workflow ID once, the user sees trace data, token metrics, and checker pass rate all on one page. The standalone Metrics page and its nav entry are removed.

---

## Motivation

Both Metrics panels (Token Usage and Checker Pass Rate) and Trace Logs start with a workflow ID search. Requiring users to re-enter the same workflow ID on separate pages is unnecessary friction. Consolidating lets one search power all three data sources.

The standalone search modes of the Metrics Token Usage panel (job-ID-only search, date-range-only search) are dropped — they were rarely used and don't fit the workflow-centric model.

---

## File Changes

**Modify:**
- `src/pages/TraceLogsPage.tsx` — add Token Usage and Checker Pass Rate panels between the workflow info panel and the jobs list
- `src/App.tsx` — remove `/metrics` route and `MetricsPage` import
- `src/components/AppShell.tsx` — remove "Metrics" nav entry and `BarChart3` icon import

**Delete:**
- `src/pages/MetricsPage.tsx` — all UI components (`MetricCard`, `PassRateCard`, `JobPassRateChart`) and helpers (`formatJobType`, `getBarColor`, `formatLargeNumber`) move into `TraceLogsPage.tsx`

No backend changes. No new dependencies (recharts already installed).

---

## Data Flow

On workflow ID search, three TanStack Query queries fire in parallel:

1. `traceLogsApi.getByWorkflowId(workflowId)` — workflow info + aggregate + jobs list (primary)
2. `metricsApi.tokenCost({ workflowId })` — aggregate token metrics for that workflow
3. `metricsApi.checkerPassRate(workflowId)` — pass rate summary + per-job breakdown

Query keys: `['trace-workflow', workflowId]`, `['metrics-token-cost', { workflowId }]`, `['metrics-checker-pass-rate', workflowId]`.

The trace query is primary — content only renders after it succeeds. The two metrics queries render independently within the content area with their own loading/error states.

---

## Layout

Stacked single-column layout after search succeeds:

```
┌─ Search Panel (unchanged) ─────────────────────┐
│ [Workflow ID input]  [Search]                   │
└─────────────────────────────────────────────────┘

┌─ Workflow Info (unchanged) ────────────────────┐
│ ID, Document, Triggered By, Created, Status     │
└─────────────────────────────────────────────────┘

┌─ Token Usage ─────┐ ┌─ Checker Pass Rate ──────┐
│ Total Tokens       │ │ Pass Rate % (colored)    │
│ LLM Tokens         │ │ Total Checker Results    │
│ Tool Tokens        │ │ Passed Results           │
│ Prompt/Completion  │ │                          │
│ LLM/Tool Calls     │ │ Per-Job Bar Chart        │
└────────────────────┘ └──────────────────────────┘

┌─ Jobs (unchanged) ─────────────────────────────┐
│ Aggregate bar, job rows with expand/collapse    │
└─────────────────────────────────────────────────┘
```

---

## States

### Search-form state (before any submission)

Same as today: `EmptyState` "No workflow selected".

### Trace query states

| State | Display |
|---|---|
| loading | `EmptyState` "Loading workflow trace..." |
| error | `ErrorNotice` |
| success | Render all panels; metrics load independently within |

### Metrics panel states (inside success)

| State | Token Usage | Checker Pass Rate |
|---|---|---|
| loading | Panel shows spinner | Panel shows spinner |
| error | Inline `ErrorNotice` within panel | Inline `ErrorNotice` within panel |
| success (no data) | Cards show zeros | Pass rate at 0.0%, results at 0 |
| success | Five metric cards | Pass rate card + count cards + bar chart (if jobs non-empty) |

### Edge cases

- `checkerData.jobs` is empty or null → hide bar chart, still show summary cards
- Token metrics API returns 200 with zero values when no data matches → display zeros, not an error
- Existing trace behaviors (knowledge gap badges, failed job highlighting) are unchanged

---

## Component Inventory

New sub-components in `TraceLogsPage.tsx`, following the existing pattern of file-local components:

- **`TokenMetricsPanel`** — receives `TokenCostResponse`, renders 5 `MetricCard`s in a 2-column grid
- **`CheckerPassRatePanel`** — receives `CheckerPassRateResponse`, renders `PassRateCard`, count cards, and `JobPassRateChart`
- **`MetricCard`** — reused from current `MetricsPage.tsx` (label/value card)
- **`PassRateCard`** — reused (color-coded percentage card)
- **`JobPassRateChart`** — reused (recharts horizontal bar chart)
- **`formatLargeNumber`**, **`formatJobType`**, **`getBarColor`** — reused helpers

---

## What Gets Removed

- Route `/metrics` and lazy-loaded `MetricsPage` component
- Sidebar nav item "Metrics" (BarChart3 icon)
- Token Usage search form (workflow ID, job ID, from/to inputs) — replaced by auto-driven query from the page's workflow ID
- Checker Pass Rate search form (workflow ID input) — same
- Standalone job-ID and date-range-only search modes for token cost

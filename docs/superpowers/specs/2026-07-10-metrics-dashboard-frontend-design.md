# Metrics Dashboard Page — Frontend Design Spec

**Date:** 2026-07-10
**Status:** Draft
**BE Spec:** `C:\Work\Workspace\hkex\BusinessRequirementService\docs\superpowers\specs\2026-07-10-metrics-api-spec.md`

## 1. Background

The BusinessRequirementService backend exposes two metrics API endpoints:
- `GET /api/v1/metrics/token-cost` — aggregated token usage (LLM + tool calls)
- `GET /api/v1/metrics/checker-pass-rate` — rule checker pass rate by workflow

The frontend needs a dedicated Metrics page to present these as dashboards with appropriate filtering controls.

## 2. API Contract Summary

### 2.1 Token Cost Metrics

```
GET /api/v1/metrics/token-cost?workflowId=&jobId=&from=&to=
```

All params optional; at least one required (400 if none). Response:

```json
{
  "filters": { "workflowId": "...", "jobId": null, "from": "2026-07-01", "to": "2026-07-10" },
  "metrics": {
    "llmCallCount": 85, "toolCallCount": 23,
    "llmPromptTokens": 1523000, "llmCompletionTokens": 289000,
    "toolPromptTokens": 12400, "toolCompletionTokens": 3100
  }
}
```

200 with zeros when no data matches.

### 2.2 Checker Pass Rate

```
GET /api/v1/metrics/checker-pass-rate?workflowId=<required>
```

```json
{
  "workflowId": "WF-2026-0709-001",
  "totalRulesExtracted": 28,
  "rulesPassedCheck": 26,
  "passRate": 92.9
}
```

400 when workflowId is missing.

## 3. UI Design

### 3.1 Page Layout

Split 2-column grid on desktop (`lg:grid-cols-2`), stacked on mobile. Each panel has independent filter controls and data fetching.

### 3.2 Token Usage Panel (Left)

**Filters** — text inputs, all optional; "Search" button triggers query:
- Workflow ID (monospace text input)
- Job ID (monospace text input)
- From date (text input, placeholder `YYYY-MM-DD`)
- To date (text input, placeholder `YYYY-MM-DD`)

**Metric Cards** — 6 cards in a 2×3 grid:

| Card | Value | Source |
|------|-------|--------|
| **Total Tokens** | `llmPrompt + llmCompletion + toolPrompt + toolCompletion` | FE calculation |
| **LLM Tokens** | `llmPrompt + llmCompletion` | FE calculation |
| **Tool Tokens** | `toolPrompt + toolCompletion` | FE calculation |
| **LLM Calls** | `metrics.llmCallCount` | API |
| **Tool Calls** | `metrics.toolCallCount` | API |
| **Prompt / Completion** | `metrics.llmPromptTokens` / `metrics.llmCompletionTokens` | API — shown as a ratio or two sub-values |

Token values formatted: ≥1M → `1.52M`, ≥1K → `289K`, else raw. Use `formatBytes`-style formatting or a simple `formatLargeNumber()` helper.

**States:**
- No search yet → `EmptyState` "Enter filters and click Search"
- Loading → disable Search button, show spinner
- Error → `ErrorNotice` with API error message
- Zero results → metric cards show 0 / "0"

### 3.3 Checker Pass Rate Panel (Right)

**Filter** — single text input:
- Workflow ID (monospace, required)

**Metric Cards** — 3 cards:

| Card | Value | Source | Color |
|------|-------|--------|-------|
| **Pass Rate** | `passRate` % | API | ≥90 green, ≥70 amber, <70 red |
| **Total Rules** | `totalRulesExtracted` | API | Neutral |
| **Rules Passed** | `rulesPassedCheck` | API | Green |

**States:**
- No search yet → `EmptyState` "Enter a workflow ID and click Search"
- Loading → disable Search button
- Error → `ErrorNotice`
- Zero rules → Pass Rate shows "0.0%", rules show 0

### 3.4 Navigation

- Route: `/metrics`
- Nav entry: "Metrics" with `BarChart3` icon (lucide-react), placed after "Trace Logs"

## 4. Type Definitions

```ts
// API request params
export type TokenCostParams = {
  workflowId?: string; jobId?: string; from?: string; to?: string
}

// Token cost response
export type TokenCostResponse = {
  filters: { workflowId: string | null; jobId: string | null; from: string | null; to: string | null }
  metrics: {
    llmCallCount: number; toolCallCount: number
    llmPromptTokens: number; llmCompletionTokens: number
    toolPromptTokens: number; toolCompletionTokens: number
  }
}

// Checker pass rate response
export type CheckerPassRateResponse = {
  workflowId: string
  totalRulesExtracted: number
  rulesPassedCheck: number
  passRate: number
}
```

## 5. Files

| File | Action | Description |
|------|--------|-------------|
| `src/api.ts` | Modify | Add 3 types + `metricsApi` with `tokenCost()` and `checkerPassRate()` |
| `src/pages/MetricsPage.tsx` | Create | New page with split layout, two panels, metric cards |
| `src/App.tsx` | Modify | Add `/metrics` route |
| `src/components/AppShell.tsx` | Modify | Add "Metrics" nav entry (`BarChart3`), after Trace Logs |

## 6. Verification

- `npm run lint` — zero new errors in touched files
- `npm run build` — zero errors from touched files
- `npm test` — 19 existing vitest tests still pass
- Manual smoke: enter workflow/date filters on Token Usage panel, verify cards populate; enter workflow ID on Checker Pass Rate panel, verify pass rate displays with correct color

## 7. Out of Scope

- Charts/graphs (bar charts, line charts, etc.) — metric cards only
- Date picker UI — plain text inputs only
- Auto-complete for workflow/job IDs
- Export/download functionality
- Real-time auto-refresh (polling) — manual Search trigger only

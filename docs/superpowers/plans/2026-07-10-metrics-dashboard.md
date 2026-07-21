# Metrics Dashboard Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Metrics" dashboard page with two panels — Token Usage (5 metric cards with filters) and Checker Pass Rate (3 metric cards with workflow filter) — using the backend's new `/api/v1/metrics/*` endpoints.

**Architecture:** Add `metricsApi` to `api.ts` using the existing `http` client (same `/api/v1` base, proxied to port 8082). Create `MetricsPage.tsx` with a split 2-column layout, each panel independently managing its own filter state and TanStack Query fetch. Add route and nav entry. No new dependencies, no charts.

**Tech Stack:** React 19, TypeScript (verbatimModuleSyntax, erasableSyntaxOnly, noUnusedLocals/Parameters), TanStack Query 5, existing UI components (Panel, PanelHeader, Button, TextInput, EmptyState, ErrorNotice, StatusPill), lucide-react (BarChart3).

**Spec:** `docs/superpowers/specs/2026-07-10-metrics-dashboard-frontend-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/api.ts` | Modify | Add 3 types + `metricsApi` with `tokenCost()` and `checkerPassRate()` |
| `src/pages/MetricsPage.tsx` | Create | New page: split layout, two panels, metric cards, filters |
| `src/App.tsx` | Modify | Add `/metrics` route |
| `src/components/AppShell.tsx` | Modify | Add "Metrics" nav entry (`BarChart3`), after Trace Logs |

4 files: 1 create, 3 modify. No tests added (all logic is UI + type definitions).

---

## Conventions

- **Reuse existing `http` client** (baseURL `/api/v1`, already proxied to port 8082). Do NOT create a new axios client.
- **TypeScript strictness:** `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `noUnusedLocals`/`noUnusedParameters`.
- **Verification:** `npm run lint && npm run build && npm test` before each commit.
- **Commits:** Conventional Commits. End with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

---

## Task 1: Add metrics types and API client to api.ts

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: Add types and API object**

READ the current `src/api.ts` to find the right insertion point (near the end, before `fromResponse`/`optionalFromResponse` helpers or after the last `*Api` object).

Insert the following types and API object:

```ts
// ---------------------------------------------------------------------------
// Metrics API
// ---------------------------------------------------------------------------

export type TokenCostParams = {
  workflowId?: string
  jobId?: string
  from?: string
  to?: string
}

export type TokenCostResponse = {
  filters: {
    workflowId: string | null
    jobId: string | null
    from: string | null
    to: string | null
  }
  metrics: {
    llmCallCount: number
    toolCallCount: number
    llmPromptTokens: number
    llmCompletionTokens: number
    toolPromptTokens: number
    toolCompletionTokens: number
  }
}

export type CheckerPassRateResponse = {
  workflowId: string
  totalRulesExtracted: number
  rulesPassedCheck: number
  passRate: number
}

export const metricsApi = {
  tokenCost: (params: TokenCostParams) =>
    fromResponse<TokenCostResponse>(http.get('/metrics/token-cost', { params })),
  checkerPassRate: (workflowId: string) =>
    fromResponse<CheckerPassRateResponse>(
      http.get('/metrics/checker-pass-rate', { params: { workflowId } }),
    ),
}
```

Note: reuses existing `http` client (baseURL `/api/v1`) and module-private `fromResponse` helper.

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: zero new errors. 19 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "$(cat <<'EOF'
feat: add metrics API client and types

Adds TokenCostParams, TokenCostResponse, CheckerPassRateResponse types
and metricsApi object (tokenCost + checkerPassRate) using the existing
http client. No UI yet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create MetricsPage with Token Usage panel

**Files:**
- Create: `src/pages/MetricsPage.tsx`

This task creates the new page with only the Token Usage (left) panel. The Checker Pass Rate panel and route/nav wiring land in Tasks 3 and 4.

- [ ] **Step 1: Read reference patterns**

Read `src/pages/TraceLogsPage.tsx` for the search-triggered query pattern (searchParams, handleSubmit, manual fetch). The Metrics page follows the same pattern — queries are triggered by a Search button click, not auto-fetched.

- [ ] **Step 2: Create MetricsPage.tsx with Token Usage panel**

Create `src/pages/MetricsPage.tsx`:

```tsx
import { type FormEvent, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Search } from 'lucide-react'
import { getErrorMessage, metricsApi, type TokenCostParams, type TokenCostResponse } from '../api'
import { Button, EmptyState, ErrorNotice, Label, PageTitle, Panel, PanelHeader, TextInput } from '../components/ui'

export function MetricsPage() {
  // Token Usage state
  const [tokenParams, setTokenParams] = useState<TokenCostParams>({})
  const [submittedParams, setSubmittedParams] = useState<TokenCostParams | null>(null)

  const tokenQuery = useQuery({
    queryKey: ['metrics-token-cost', submittedParams],
    queryFn: () => metricsApi.tokenCost(submittedParams!),
    enabled: submittedParams !== null,
  })

  const tokenData = tokenQuery.data

  function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const p = { ...tokenParams }
    // Remove empty strings so undefined params are omitted from the request
    const cleaned: TokenCostParams = {}
    if (p.workflowId?.trim()) cleaned.workflowId = p.workflowId.trim()
    if (p.jobId?.trim()) cleaned.jobId = p.jobId.trim()
    if (p.from?.trim()) cleaned.from = p.from.trim()
    if (p.to?.trim()) cleaned.to = p.to.trim()
    setSubmittedParams(Object.keys(cleaned).length > 0 ? cleaned : null)
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Metrics"
        description="Token usage and checker pass rate dashboards for agent job runs."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Token Usage Panel */}
        <Panel>
          <PanelHeader title="Token Usage" description="Aggregated token consumption across LLM and tool calls." />
          <form onSubmit={handleTokenSubmit} className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Label label="Workflow ID">
                <TextInput
                  className="font-mono"
                  placeholder="e.g. WF-2026-0709-001"
                  value={tokenParams.workflowId || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, workflowId: e.target.value || undefined }))}
                />
              </Label>
              <Label label="Job ID">
                <TextInput
                  className="font-mono"
                  placeholder="UUID"
                  value={tokenParams.jobId || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, jobId: e.target.value || undefined }))}
                />
              </Label>
              <Label label="From">
                <TextInput
                  placeholder="YYYY-MM-DD"
                  value={tokenParams.from || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, from: e.target.value || undefined }))}
                />
              </Label>
              <Label label="To">
                <TextInput
                  placeholder="YYYY-MM-DD"
                  value={tokenParams.to || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, to: e.target.value || undefined }))}
                />
              </Label>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={tokenQuery.isFetching}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Button>
            </div>
          </form>

          {!submittedParams ? (
            <div className="p-4 pt-0">
              <EmptyState title="Enter filters and click Search" description="At least one filter is required." />
            </div>
          ) : tokenQuery.isError ? (
            <div className="p-4 pt-0">
              <ErrorNotice message={getErrorMessage(tokenQuery.error)} />
            </div>
          ) : tokenData ? (
            <div className="grid grid-cols-2 gap-3 p-4 pt-0">
              <MetricCard label="Total Tokens" value={formatLargeNumber(
                tokenData.metrics.llmPromptTokens + tokenData.metrics.llmCompletionTokens +
                tokenData.metrics.toolPromptTokens + tokenData.metrics.toolCompletionTokens
              )} />
              <MetricCard label="LLM Tokens" value={formatLargeNumber(
                tokenData.metrics.llmPromptTokens + tokenData.metrics.llmCompletionTokens
              )} />
              <MetricCard label="Tool Tokens" value={formatLargeNumber(
                tokenData.metrics.toolPromptTokens + tokenData.metrics.toolCompletionTokens
              )} />
              <MetricCard
                label="Prompt / Completion"
                value={`${formatLargeNumber(tokenData.metrics.llmPromptTokens)} / ${formatLargeNumber(tokenData.metrics.llmCompletionTokens)}`}
                small
              />
              <MetricCard
                label="LLM / Tool Calls"
                value={`${tokenData.metrics.llmCallCount} / ${tokenData.metrics.toolCallCount}`}
                small
              />
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  small,
}: {
  label: string
  value: string | number
  small?: boolean
}) {
  return (
    <div className="rounded-md border border-[#e3e8f0] bg-[#f8fafc] px-4 py-3 text-center">
      <div className={small ? 'text-base font-semibold text-[#172033]' : 'text-2xl font-bold text-[#172033]'}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[#667085]">{label}</div>
    </div>
  )
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}
```

Key design decisions:
- `submittedParams` is null until the user clicks Search — prevents auto-fetch on mount
- Empty filter values are stripped from the request so axios omits them as query params
- `MetricCard` is a simple helper component defined in the same file
- `formatLargeNumber` is inline (not in utils.ts) — single-use helper

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: zero new errors (route/nav aren't wired yet, so the page exists but isn't reachable). 19 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MetricsPage.tsx
git commit -m "$(cat <<'EOF'
feat: add Metrics page with Token Usage panel

Creates MetricsPage with search-triggered Token Usage panel showing
5 metric cards (Total/LLM/Tool tokens, Prompt/Completion ratio, and
LLM/Tool call counts). Filterable by workflow ID, job ID, and date
range. Checker Pass Rate panel and route wiring in next commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Checker Pass Rate panel to MetricsPage

**Files:**
- Modify: `src/pages/MetricsPage.tsx`

This task adds the right-side Checker Pass Rate panel to the existing page, completing the 2-column layout.

- [ ] **Step 1: Read the current file**

Read `src/pages/MetricsPage.tsx` to see the current state after Task 2.

- [ ] **Step 2: Add checker state, query, and panel**

Add the following inside the `MetricsPage` function, after the existing `tokenData` line:

```tsx
// Checker Pass Rate state
const [checkerWorkflowId, setCheckerWorkflowId] = useState('')
const [submittedCheckerWfId, setSubmittedCheckerWfId] = useState('')

const checkerQuery = useQuery({
  queryKey: ['metrics-checker-pass-rate', submittedCheckerWfId],
  queryFn: () => metricsApi.checkerPassRate(submittedCheckerWfId),
  enabled: Boolean(submittedCheckerWfId),
})

const checkerData = checkerQuery.data

function handleCheckerSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setSubmittedCheckerWfId(checkerWorkflowId.trim())
}
```

Update the import line to include `type CheckerPassRateResponse`:
```tsx
import { getErrorMessage, metricsApi, type CheckerPassRateResponse, type TokenCostParams, type TokenCostResponse } from '../api'
```

Now add the Checker Pass Rate panel inside the grid, after the closing `</Panel>` of the Token Usage panel. The grid already has `lg:grid-cols-2` so both panels will be side by side.

Insert after `</Panel>` (the Token Usage panel end) and before `</div>` (the grid end):

```tsx
        {/* Checker Pass Rate Panel */}
        <Panel>
          <PanelHeader title="Checker Pass Rate" description="Rule checker validation results by workflow." />
          <form onSubmit={handleCheckerSubmit} className="space-y-3 p-4">
            <Label label="Workflow ID">
              <TextInput
                className="font-mono"
                placeholder="e.g. WF-2026-0709-001"
                value={checkerWorkflowId}
                onChange={(e) => setCheckerWorkflowId(e.target.value)}
              />
            </Label>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={!checkerWorkflowId.trim() || checkerQuery.isFetching}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Button>
            </div>
          </form>

          {!submittedCheckerWfId ? (
            <div className="p-4 pt-0">
              <EmptyState title="Enter a workflow ID and click Search" />
            </div>
          ) : checkerQuery.isError ? (
            <div className="p-4 pt-0">
              <ErrorNotice message={getErrorMessage(checkerQuery.error)} />
            </div>
          ) : checkerData ? (
            <div className="grid grid-cols-1 gap-3 p-4 pt-0">
              <PassRateCard rate={checkerData.passRate} />
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Total Rules" value={checkerData.totalRulesExtracted} />
                <MetricCard label="Rules Passed" value={checkerData.rulesPassedCheck} />
              </div>
            </div>
          ) : null}
        </Panel>
```

Add the `PassRateCard` component at the bottom of the file (after `MetricCard`):

```tsx
function PassRateCard({ rate }: { rate: number }) {
  const colorClass =
    rate >= 90 ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]'
    : rate >= 70 ? 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]'
    : 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]'

  return (
    <div className={`rounded-md border px-4 py-6 text-center ${colorClass}`}>
      <div className="text-3xl font-bold">{rate.toFixed(1)}%</div>
      <div className="mt-1 text-xs opacity-70">Pass Rate</div>
    </div>
  )
}
```

Also update the `MetricsPage` return's inner content so that the grid `lg:grid-cols-2` still wraps both panels correctly. The structure should be:

```tsx
<div className="grid gap-5 lg:grid-cols-2">
  <Panel> {/* Token Usage */} </Panel>
  <Panel> {/* Checker Pass Rate */} </Panel>
</div>
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: zero new errors. 19 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MetricsPage.tsx
git commit -m "$(cat <<'EOF'
feat: add Checker Pass Rate panel to Metrics page

Adds right-side panel with workflow ID filter and 3 metric displays:
pass rate (color-coded: >=90% green, >=70% amber, <70% red), total
rules extracted, and rules passed. Completes the 2-column dashboard
layout. Route and nav wiring in next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Route and nav entry

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Add route in App.tsx**

READ `src/App.tsx` to confirm current routes.

Add the import (alphabetical order):
```tsx
import { MetricsPage } from './pages/MetricsPage'
```

Add the route inside `<Route element={<AppShell />}>`, after the trace-logs route:
```tsx
<Route path="/metrics" element={<MetricsPage />} />
```

- [ ] **Step 2: Add nav entry in AppShell.tsx**

READ `src/components/AppShell.tsx` to confirm current imports and navItems.

Update the lucide-react import to include `BarChart3` (alphabetical order):
```tsx
import { Activity, BarChart3, BookOpen, ChevronLeft, ChevronRight, FileText, GitBranch, Layers3, ScrollText, Settings, ShieldCheck } from 'lucide-react'
```

Add the nav entry at the end of navItems:
```tsx
const navItems = [
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { to: '/workflows', label: 'Workflows', icon: GitBranch },
  { to: '/skills', label: 'Skills', icon: Settings },
  { to: '/application-logs', label: 'Application Logs', icon: ScrollText },
  { to: '/trace-logs', label: 'Trace Logs', icon: Activity },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
]
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: zero new errors. 19 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AppShell.tsx
git commit -m "$(cat <<'EOF'
feat: add /metrics route and navigation entry

Wires the Metrics dashboard page into the router and sidebar (icon
BarChart3), placed after Trace Logs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After all four tasks land:

- [ ] **Step 1: Full lint, build, and tests**

Run: `npm run lint && npm run build && npm test`
Expected: only pre-existing errors in other files. 19 tests pass.

- [ ] **Step 2: Manual smoke test**

Prerequisites: BusinessRule backend on port 8082 with the metrics endpoints deployed.

1. Open `http://localhost:5173/metrics` (or whichever port `npm run dev` assigns)
2. **Token Usage:** Enter a workflow ID (e.g. `WF-2026-0709-001`) and click Search. Verify the 5 metric cards populate with real token data.
3. **Token Usage:** Try date range only (`from`/`to`). Verify cards show data.
4. **Token Usage:** Click Search with all empty filters. Verify nothing happens (empty state remains).
5. **Token Usage:** Test all-zeros response (use a non-existent workflow). Verify cards show 0 / "0".
6. **Checker Pass Rate:** Enter a workflow ID and click Search. Verify pass rate card shows percentage with correct color.
7. **Checker Pass Rate:** Submit without workflow ID. Verify button is disabled.
8. **Nav:** Click other nav items to confirm they still work.

---

## Notes for the implementer

- **Reuse the existing `http` client** — metrics endpoints are at `/metrics/token-cost` and `/metrics/checker-pass-rate` under the same `/api/v1` base. The Vite proxy already routes `/api` to port 8082.
- **`TokenCostParams`** has all optional fields — axios omits `undefined` values from query params. The manual cleaning of empty strings in `handleTokenSubmit` ensures only filled-in filters are sent.
- **Don't commit unrelated WIP.** Only stage files this plan explicitly touches.
- **`BarChart3`** is a standard lucide-react icon (verified in the installed version).
- **`MetricCard` and `PassRateCard` are inline** in MetricsPage.tsx — they're private helpers not exported.

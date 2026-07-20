# Merge Metrics into Trace Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the standalone Metrics page into Trace Logs — one workflow ID search powers trace data, token metrics, and checker pass rate.

**Architecture:** Three parallel TanStack Query queries fire on workflow ID search. Trace query is primary (content gates on it), two metrics queries render independently within. All UI components move from MetricsPage.tsx into TraceLogsPage.tsx as file-local components.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, recharts, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-07-20-merge-metrics-into-trace-logs-design.md`

---

### Task 1: Remove Metrics route and nav entry

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Remove MetricsPage route from App.tsx**

Remove the import:
```tsx
import { MetricsPage } from './pages/MetricsPage'
```

Remove the route:
```tsx
<Route path="/metrics" element={<MetricsPage />} />
```

- [ ] **Step 2: Remove Metrics nav entry from AppShell.tsx**

Remove `BarChart3` from the lucide-react import:
```tsx
import { Activity, BookOpen, ChevronLeft, ChevronRight, FileText, GitBranch, Layers3, ScrollText, Settings, ShieldCheck } from 'lucide-react'
```

Remove the nav entry from `navItems`:
```tsx
{ to: '/metrics', label: 'Metrics', icon: BarChart3 },
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: No new errors in App.tsx or AppShell.tsx (pre-existing ReviewWorkbenchPage errors are fine)

---

### Task 2: Add metrics queries and panels to TraceLogsPage

**Files:**
- Modify: `src/pages/TraceLogsPage.tsx`

- [ ] **Step 1: Add new imports at top of TraceLogsPage.tsx**

Update the existing `../api` import to include metrics types and functions:
```tsx
import { getErrorMessage, metricsApi, traceLogsApi, type CheckerPassRateJob, type CheckerPassRateResponse, type JobTraceResponse, type JobTraceSummary, type LlmCallTrace, type TokenCostResponse } from '../api'
```

Add recharts import:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
```

- [ ] **Step 2: Add metrics query hooks inside the TraceLogsPage component**

After the `workflowTrace` declaration (~line 22), add the two new queries:

```tsx
const tokenCostQuery = useQuery({
  queryKey: ['metrics-token-cost', { workflowId: submittedWorkflowId }],
  queryFn: () => metricsApi.tokenCost({ workflowId: submittedWorkflowId }),
  enabled: Boolean(submittedWorkflowId) && workflowTraceQuery.isSuccess,
})

const checkerPassRateQuery = useQuery({
  queryKey: ['metrics-checker-pass-rate', submittedWorkflowId],
  queryFn: () => metricsApi.checkerPassRate(submittedWorkflowId),
  enabled: Boolean(submittedWorkflowId) && workflowTraceQuery.isSuccess,
})
```

- [ ] **Step 3: Add metrics panels in the JSX between the Workflow Info panel and the Jobs panel**

After the closing `</Panel>` of the Workflow Info panel and before the Jobs `<Panel>`, insert:

```tsx
{workflowTrace ? (
  <div className="grid gap-5 lg:grid-cols-2">
    <Panel>
      <PanelHeader title="Token Usage" description="Aggregated token consumption across LLM and tool calls." />
      {tokenCostQuery.isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-[#667085]">Loading metrics...</div>
      ) : tokenCostQuery.isError ? (
        <div className="p-4"><ErrorNotice message={getErrorMessage(tokenCostQuery.error)} /></div>
      ) : tokenCostQuery.data ? (
        <TokenMetricsPanel data={tokenCostQuery.data} />
      ) : null}
    </Panel>

    <Panel>
      <PanelHeader title="Checker Pass Rate" description="Rule checker validation results by workflow." />
      {checkerPassRateQuery.isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-[#667085]">Loading metrics...</div>
      ) : checkerPassRateQuery.isError ? (
        <div className="p-4"><ErrorNotice message={getErrorMessage(checkerPassRateQuery.error)} /></div>
      ) : checkerPassRateQuery.data ? (
        <CheckerPassRatePanel data={checkerPassRateQuery.data} />
      ) : null}
    </Panel>
  </div>
) : null}
```

Note: Move the `{workflowTrace ? (<>...</>)}` wrapper to encompass both the new metrics row and the existing workflow info + jobs panels.

- [ ] **Step 4: Add helper components at the bottom of the file**

After the existing `formatTokens` function, add these components copied from `MetricsPage.tsx`:

**`MetricCard`** — (copy from MetricsPage.tsx lines 178-193)
**`PassRateCard`** — (copy from MetricsPage.tsx lines 197-209)
**`JobPassRateChart`** — (copy from MetricsPage.tsx lines 211-244, includes recharts BarChart)
**`formatJobType`** — (copy from MetricsPage.tsx lines 246-248)
**`getBarColor`** — (copy from MetricsPage.tsx lines 250-254)
**`formatLargeNumber`** — (copy from MetricsPage.tsx lines 256-260)

**`TokenMetricsPanel`** — new wrapper component:
```tsx
function TokenMetricsPanel({ data }: { data: TokenCostResponse }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 pt-0">
      <MetricCard label="Total Tokens" value={formatLargeNumber(
        data.metrics.llmPromptTokens + data.metrics.llmCompletionTokens +
        data.metrics.toolPromptTokens + data.metrics.toolCompletionTokens
      )} />
      <MetricCard label="LLM Tokens" value={formatLargeNumber(
        data.metrics.llmPromptTokens + data.metrics.llmCompletionTokens
      )} />
      <MetricCard label="Tool Tokens" value={formatLargeNumber(
        data.metrics.toolPromptTokens + data.metrics.toolCompletionTokens
      )} />
      <MetricCard
        label="Prompt / Completion"
        value={`${formatLargeNumber(data.metrics.llmPromptTokens)} / ${formatLargeNumber(data.metrics.llmCompletionTokens)}`}
        small
      />
      <MetricCard
        label="LLM / Tool Calls"
        value={`${data.metrics.llmCallCount} / ${data.metrics.toolCallCount}`}
        small
      />
    </div>
  )
}
```

**`CheckerPassRatePanel`** — new wrapper component:
```tsx
function CheckerPassRatePanel({ data }: { data: CheckerPassRateResponse }) {
  return (
    <div className="space-y-3 p-4 pt-0">
      <PassRateCard rate={data.passRate} />
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total Checker Results" value={data.totalCheckerResults} />
        <MetricCard label="Passed Results" value={data.passedCheckerResults} />
      </div>
      {data.jobs != null && data.jobs.length > 0 && <JobPassRateChart jobs={data.jobs} />}
    </div>
  )
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: No new errors in TraceLogsPage.tsx

---

### Task 3: Delete MetricsPage.tsx

**Files:**
- Delete: `src/pages/MetricsPage.tsx`

- [ ] **Step 1: Delete the file**

Run: `rm src/pages/MetricsPage.tsx`

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean of MetricsPage-related errors (pre-existing ReviewWorkbenchPage errors OK)

---

### Task 4: Verify and commit

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 2: Run final build**

Run: `npm run build`
Expected: Only pre-existing ReviewWorkbenchPage/WorkflowOverviewPage errors remain

- [ ] **Step 3: Commit all changes**

```bash
git add src/App.tsx src/components/AppShell.tsx src/pages/TraceLogsPage.tsx src/pages/MetricsPage.tsx docs/superpowers/specs/2026-07-20-merge-metrics-into-trace-logs-design.md docs/superpowers/plans/2026-07-21-merge-metrics-into-trace-logs.md
git commit -m "feat: merge metrics page into trace logs page

Search workflow ID once to view trace data, token metrics, and checker pass rate on a single page. Remove standalone /metrics route and nav entry."
```

# Design: Workflow Trace Page

**Date:** 2026-07-20
**Status:** Approved
**Parent spec:** `BusinessRequirementService/docs/superpowers/specs/2026-07-20-trace-workflow-api-spec.md`

---

## Summary

Replace the job-ID-based trace log page with a workflow-ID-based page. The new page shows a summary of all jobs in a workflow, with on-demand drill-down into each job's full trace (LLM calls, tool calls, unknown terms).

---

## Backend Contract (from parent spec)

### `GET /api/v1/trace/workflows/{workflowId}`

Returns a lightweight job list + aggregate signals:

```json
{
  "workflow": { "id": "...", "documentId": "...", "status": "...", "triggeredBy": "...", "createdAt": "...", "updatedAt": "..." },
  "jobs": [
    { "id": "...", "jobType": "SEMANTIC_MAKER", "status": "SUCCEEDED", "errorMessage": null, "createdAt": "..." }
  ],
  "aggregate": { "totalJobs": 11, "failedJobs": 2, "hasUnknownTerms": true }
}
```

### `GET /api/v1/trace/jobs/{jobId}` (existing, unchanged)

Full drill-down with agent sessions, LLM calls, tool calls, unknown terms.

---

## Architecture

Two queries, lazy drill-down:

```
User enters workflow ID → GET /trace/workflows/{workflowId} (job list)
  → Renders: workflow info + aggregate stats + job summary table
  → User clicks a job row → GET /trace/jobs/{jobId} (existing endpoint)
    → Renders inline: full trace with sessions, LLM calls, tool calls, unknown terms
```

---

## Implementation

### 1. API changes — `src/api.ts`

**New types:**

```typescript
export type JobTraceSummary = {
  id: string
  jobType: string
  status: string
  errorMessage?: string | null
  createdAt: string
}

export type WorkflowTraceAggregate = {
  totalJobs: number
  failedJobs: number
  hasUnknownTerms: boolean
}

export type WorkflowTraceResponse = {
  workflow: WorkflowTraceRecord
  jobs: JobTraceSummary[]
  aggregate: WorkflowTraceAggregate
}
```

**New API function (add to `traceLogsApi`):**

```typescript
getByWorkflowId: (workflowId: string) =>
  fromResponse<WorkflowTraceResponse>(http.get(`/trace/workflows/${encodeURIComponent(workflowId)}`))
```

### 2. Page rewrite — `src/pages/TraceLogsPage.tsx`

**Replace entirely.** The current page is job-ID-based with a single trace view. The new page has:

#### 2a. Search form

Workflow ID input (replaces job ID input). Uses `useSearchParams` to persist the workflow ID in the URL (`?workflowId=...`). On submit, triggers the workflow trace query.

#### 2b. Workflow info panel

Shows workflow metadata: ID, document ID, status, triggered by, created/updated dates. Reuses existing `TraceField` component.

#### 2c. Aggregate bar

Compact row below the workflow panel:

- `totalJobs` count
- `failedJobs` count (red highlight when > 0)
- "Knowledge Gaps" red badge when `hasUnknownTerms` is true
- Uses `AlertTriangle` icon from lucide-react for the knowledge gaps badge

#### 2d. Job summary table

Each row shows: job type, `StatusPill`, formatted date, truncated error message (first 120 chars).

- Rows with `FAILED` status get a red left border (`border-l-[#f7b4ae]`)
- Rows with `FAILED_UNKNOWN_TERMS` status (or when aggregate hasUnknownTerms) show an `AlertTriangle` icon
- Clicking a row triggers drill-down

#### 2e. Drill-down (inline expansion)

When a job row is clicked:

1. `useQuery` fires with `queryKey: ['trace-log', jobId]` — same cache key as the existing endpoint, so TanStack Query handles dedup and caching
2. The row expands to show the full trace detail inline
3. Reuses the existing rendering logic: `LlmCalls` component, `TraceField`, `PayloadDetails`, `SourcesList`, unknown terms banner
4. Clicking the same row again collapses it
5. Clicking a different row switches the expanded row

The existing `LlmCalls` function and all its sub-components (`PayloadDetails`, `TraceField`, `formatDuration`, `formatTokens`) are preserved and reused as-is.

### 3. What gets removed

- Job ID search form and related state (`jobId`, `submittedJobId`)
- Job info panel (single job details) — replaced by workflow info panel
- Workflow info panel (was nested under job) — now the primary panel
- The single-job `traceQuery` — replaced by `workflowTraceQuery` + per-job `jobTraceQuery`

### 4. Loading and error states

- **Workflow trace loading:** Show `EmptyState` with "Loading workflow trace..." 
- **Workflow trace error:** Show `ErrorNotice` with the error message
- **Workflow not found:** Show `EmptyState` with "Workflow not found"
- **Job trace loading (drill-down):** Show a subtle loading indicator in the expanded row
- **Job trace error:** Show `ErrorNotice` inline in the expanded row

---

## Files Changed

| File | Change |
|---|---|
| `src/api.ts` | Add `JobTraceSummary`, `WorkflowTraceAggregate`, `WorkflowTraceResponse` types; add `getByWorkflowId` to `traceLogsApi` |
| `src/pages/TraceLogsPage.tsx` | Rewrite: workflow ID search, aggregate bar, job summary table with expandable drill-down rows |

---

## Edge Cases

| Case | Behavior |
|---|---|
| Workflow has zero jobs | Show empty state "No jobs found for this workflow" |
| Workflow ID not found | 404 → ErrorNotice |
| Job trace fetch fails | ErrorNotice inline in expanded row; other rows unaffected |
| Job has `FAILED_UNKNOWN_TERMS` status | Show `AlertTriangle` icon in row; unknown terms banner in drill-down |
| `hasUnknownTerms` true but all jobs succeeded | Show knowledge gaps badge — user can drill down to see which sessions had terms |
| `errorMessage` is very long | Truncate to 120 chars in table row; full text in drill-down |
| User switches workflow ID while a row is expanded | Collapse all rows; new workflow trace loads |
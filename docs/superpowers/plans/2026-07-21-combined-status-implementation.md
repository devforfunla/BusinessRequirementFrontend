# Combined Status (derivedStatus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `FAILED_UNKNOWN_TERMS` with `derivedStatus` field. `SUCCESS_WITH_UNKNOWN` shows amber warning and allows proceeding; `FAILED_WITH_UNKNOWN` shows red error and blocks.

**Architecture:** `derivedStatus` is added to `AsyncJob`, `JobTraceSummary`, and `JobTraceResponse`. StatusPill gains amber/red mappings for new statuses. Stage pages branch on `derivedStatus` for toast + unknown-terms-modal behavior. TraceLogsPage uses `derivedStatus` for job row display and aggregate bar.

**Tech Stack:** React 19, TypeScript, TanStack Query 5

**Spec:** `docs/superpowers/specs/2026-07-21-combined-status-frontend-design.md`

---

### Task 1: Update types and helpers in api.ts

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: Add derivedStatus to AsyncJob**

Read `AsyncJob` type at line 40. Add `derivedStatus?: string | null` after the `status` field.

```ts
export type AsyncJob = {
  id: string
  // ... existing fields ...
  jobType: string
  status: string
  derivedStatus?: string | null   // NEW
  // ... rest of fields ...
}
```

- [ ] **Step 2: Add derivedStatus to JobTraceSummary**

Read `JobTraceSummary` at line 541. Add `derivedStatus: string` field:

```ts
export type JobTraceSummary = {
  id: string
  jobType: string
  status: string
  derivedStatus: string           // NEW
  errorMessage?: string | null
  createdAt: string
}
```

- [ ] **Step 3: Add aggregate fields to WorkflowTraceAggregate**

Read `WorkflowTraceAggregate` at line 549. Add new fields:

```ts
export type WorkflowTraceAggregate = {
  totalJobs: number
  failedJobs: number
  successWithUnknownJobs: number   // NEW
  failedWithUnknownJobs: number    // NEW
  hasUnknownTerms: boolean
}
```

- [ ] **Step 4: Add derivedStatus to JobTraceResponse**

Read `JobTraceResponse` at line 637. Add `derivedStatus: string`:

```ts
export type JobTraceResponse = {
  job: AsyncJob
  derivedStatus: string            // NEW
  workflow?: WorkflowTraceRecord | null
  agentSessions: AgentTrace[]
  unscopedLlmCalls: LlmCallTrace[]
}
```

- [ ] **Step 5: Update isJobDone helper**

Read `isJobDone` at line 1092. Add `FAILED_UNKNOWN_TERMS` for backward compat:

```ts
export function isJobDone(status?: string | null) {
  const normalized = normalizeJobStatus(status)
  return normalized === 'SUCCEEDED' || normalized === 'FAILED' || normalized === 'PARTIAL_SUCCESS' || normalized === 'FAILED_UNKNOWN_TERMS'
}
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: Only pre-existing ReviewWorkbenchPage errors

---

### Task 2: Update StatusPill in ui.tsx

**Files:**
- Modify: `src/components/ui.tsx:217-232`

- [ ] **Step 1: Add SUCCESS to green group, SUCCESS_WITH_UNKNOWN to amber group, FAILED_WITH_UNKNOWN to red group**

Current StatusPill at line 220-230. Make these changes:

Green group — add `SUCCESS`:
```
normalized === 'SUCCEEDED' || normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PASSED' || normalized === 'Transformed' || normalized === 'ACTIVE' || normalized === 'SUCCESS'
```

Red group — add `FAILED_WITH_UNKNOWN`, keep `FAILED_UNKNOWN_TERMS` for backward compat:
```
normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'BLOCKED' || normalized === 'ERROR' || normalized === 'Transform Failed' || normalized === 'FAILED_UNKNOWN_TERMS' || normalized === 'FAILED_WITH_UNKNOWN'
```

Amber group — add `SUCCESS_WITH_UNKNOWN`:
```
normalized === 'PARTIAL_SUCCESS' || normalized === 'WARNED' || normalized === 'SUCCESS_WITH_UNKNOWN'
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: No new errors

---

### Task 3: Update TraceLogsPage for derivedStatus

**Files:**
- Modify: `src/pages/TraceLogsPage.tsx`

- [ ] **Step 1: Update aggregate bar — replace hasUnknownTerms badge with count badges**

Current code at lines 157-168 shows a single red "Knowledge Gaps" badge when `hasUnknownTerms` is true. Replace with two count-based badges:

```tsx
<div className="flex flex-wrap items-center gap-3 border-b border-[#e3e8f0] px-4 py-2">
  <span className="text-sm text-[#667085]">
    {workflowTrace.aggregate.totalJobs} total
  </span>
  {workflowTrace.aggregate.failedJobs > 0 ? (
    <span className="rounded border border-[#f7b4ae] bg-[#fff1f0] px-2 py-0.5 text-xs font-medium text-[#b42318]">
      {workflowTrace.aggregate.failedJobs} failed
    </span>
  ) : null}
  {workflowTrace.aggregate.successWithUnknownJobs > 0 ? (
    <span className="inline-flex items-center gap-1 rounded border border-[#f5c97a] bg-[#fffbeb] px-2 py-0.5 text-xs font-medium text-[#b54708]">
      <AlertTriangle className="h-3 w-3" />
      {workflowTrace.aggregate.successWithUnknownJobs} with knowledge gaps
    </span>
  ) : null}
  {workflowTrace.aggregate.failedWithUnknownJobs > 0 ? (
    <span className="inline-flex items-center gap-1 rounded border border-[#f7b4ae] bg-[#fff1f0] px-2 py-0.5 text-xs font-medium text-[#b42318]">
      <AlertTriangle className="h-3 w-3" />
      {workflowTrace.aggregate.failedWithUnknownJobs} failed + gaps
    </span>
  ) : null}
</div>
```

- [ ] **Step 2: Update JobRow — use derivedStatus for display**

Current code at lines 207-222. Replace the `isFailed`/`hasUnknownTerms` checks:

```tsx
function JobRow(...) {
  const derived = job.derivedStatus
  const isFailed = derived === 'FAILED' || derived === 'FAILED_WITH_UNKNOWN'
  const hasUnknownTerms = derived === 'SUCCESS_WITH_UNKNOWN' || derived === 'FAILED_WITH_UNKNOWN'

  return (
    <div>
      <button
        className={cn('flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#f8fafc]', isFailed && 'border-l-2 border-l-[#f7b4ae]')}
      >
        <span className="min-w-[140px] font-medium text-[#172033]">{job.jobType}</span>
        <StatusPill value={job.derivedStatus || job.status} />
        ...
        {hasUnknownTerms ? (
          <AlertTriangle className="h-3.5 w-3.5 text-[#b54708]" />
        ) : null}
```

Key changes:
- `StatusPill` uses `derivedStatus` (fallback to `status`)
- Red left border only for `FAILED`/`FAILED_WITH_UNKNOWN`
- Amber AlertTriangle for any unknown status (not just failed)

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: No new errors in TraceLogsPage.tsx

---

### Task 4: Update SemanticStagePage

**Files:**
- Modify: `src/pages/SemanticStagePage.tsx`

- [ ] **Step 1: Replace FAILED_UNKNOWN_TERMS branch with SUCCESS_WITH_UNKNOWN and FAILED_WITH_UNKNOWN**

In the job polling `useEffect` at line 177, replace the `FAILED_UNKNOWN_TERMS` block:

```tsx
// SUCCESS_WITH_UNKNOWN: job succeeded with knowledge gaps — amber warning, proceed allowed
if (job.derivedStatus === 'SUCCESS_WITH_UNKNOWN' || job.status === 'FAILED_UNKNOWN_TERMS') {
  toast.warning(`${semanticJobSuccessMessage(job.jobType)} with knowledge gaps`)
  traceLogsApi.getByJobId(job.id).then((trace) => {
    const allTerms = trace.agentSessions.flatMap((s) => s.unknownTerms)
    if (allTerms.length > 0) {
      setUnknownTerms({ jobType: job.jobType, terms: allTerms })
    }
  }).catch(() => {
    toast.error('Failed to load unknown terms')
  })
  window.setTimeout(() => setActiveJobId(null), 0)
  void queryClient.invalidateQueries()
  if (job.jobType === 'SEMANTIC_MAKER' && job.workflowId && job.workflowId !== workflowId) {
    setWorkflowId(job.workflowId)
    navigate(`/workflows/${encodeURIComponent(job.workflowId)}/semantic`)
  }
}

// FAILED_WITH_UNKNOWN: hard failure + knowledge gaps — red error, blocked
if (job.derivedStatus === 'FAILED_WITH_UNKNOWN') {
  toast.error(job.errorMessage || `${semanticJobFailureMessage(job.jobType)} with knowledge gaps`)
  traceLogsApi.getByJobId(job.id).then((trace) => {
    const allTerms = trace.agentSessions.flatMap((s) => s.unknownTerms)
    if (allTerms.length > 0) {
      setUnknownTerms({ jobType: job.jobType, terms: allTerms })
    }
  }).catch(() => {
    toast.error('Failed to load unknown terms')
  })
  window.setTimeout(() => setActiveJobId(null), 0)
}
```

Key change from old code: the `FAILED_UNKNOWN_TERMS` branch previously only set unknown terms and didn't invalidate or allow proceeding. Now `SUCCESS_WITH_UNKNOWN` invalidates queries and allows the user to proceed (same as SUCCEEDED, but with a warning toast + unknown terms modal).

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: No new errors in SemanticStagePage.tsx

---

### Task 5: Update AtomicStagePage

**Files:**
- Modify: `src/pages/AtomicStagePage.tsx`

- [ ] **Step 1: Replace FAILED_UNKNOWN_TERMS branch with SUCCESS_WITH_UNKNOWN and FAILED_WITH_UNKNOWN**

In the job polling `useEffect` at line 212, replace the `FAILED_UNKNOWN_TERMS` block:

```tsx
// SUCCESS_WITH_UNKNOWN: job succeeded with knowledge gaps — amber warning, proceed allowed
if (job.derivedStatus === 'SUCCESS_WITH_UNKNOWN' || job.status === 'FAILED_UNKNOWN_TERMS') {
  toast.warning(`${formatJobType(job.jobType)} completed with knowledge gaps`)
  traceLogsApi.getByJobId(job.id).then((trace) => {
    const allTerms = trace.agentSessions.flatMap((s) => s.unknownTerms)
    if (allTerms.length > 0) {
      setUnknownTerms({ jobType: job.jobType, terms: allTerms })
    }
  }).catch(() => {
    toast.error('Failed to load unknown terms')
  })
  window.setTimeout(complete, 0)
  void queryClient.invalidateQueries()
}

// FAILED_WITH_UNKNOWN: hard failure + knowledge gaps — red error, blocked
if (job.derivedStatus === 'FAILED_WITH_UNKNOWN') {
  toast.error(job.errorMessage || `${formatJobType(job.jobType)} failed with knowledge gaps`)
  traceLogsApi.getByJobId(job.id).then((trace) => {
    const allTerms = trace.agentSessions.flatMap((s) => s.unknownTerms)
    if (allTerms.length > 0) {
      setUnknownTerms({ jobType: job.jobType, terms: allTerms })
    }
  }).catch(() => {
    toast.error('Failed to load unknown terms')
  })
  window.setTimeout(complete, 0)
}
```

- [ ] **Step 2: Update job row "View unknown terms" button**

At line 1555, update the condition from `job.status === 'FAILED_UNKNOWN_TERMS'`:

```tsx
{(job.derivedStatus === 'SUCCESS_WITH_UNKNOWN' || job.derivedStatus === 'FAILED_WITH_UNKNOWN' || job.status === 'FAILED_UNKNOWN_TERMS') ? (
```

- [ ] **Step 3: Update agent session unknown terms condition in LlmTraceButton modal**

At line 1838, change the condition to also show for any session with unknown terms (not just `FAILED_UNKNOWN_TERMS`):

```tsx
{s.unknownTerms && s.unknownTerms.length > 0 ? (
```

(Remove the `finalStatus === 'FAILED_UNKNOWN_TERMS'` prefix check — if a session has unknown terms, show them regardless of the session's finalStatus.)

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: No new errors in AtomicStagePage.tsx

---

### Task 6: Final verification and commit

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 2: Run final build**

Run: `npm run build`
Expected: Only pre-existing ReviewWorkbenchPage/WorkflowOverviewPage errors remain

- [ ] **Step 3: Commit all changes**

```bash
git add src/api.ts src/components/ui.tsx src/pages/TraceLogsPage.tsx src/pages/SemanticStagePage.tsx src/pages/AtomicStagePage.tsx docs/superpowers/specs/2026-07-21-combined-status-frontend-design.md docs/superpowers/plans/2026-07-21-combined-status-implementation.md
git commit -m "feat: add derivedStatus support, replace FAILED_UNKNOWN_TERMS

Add SUCCESS_WITH_UNKNOWN (amber, proceed allowed) and FAILED_WITH_UNKNOWN (red, blocked) to StatusPill, stage pages, and TraceLogsPage aggregate bar."
```

# Design: Combined Status (derivedStatus) — Frontend

**Date:** 2026-07-21
**Status:** In Progress
**Parent spec:** `BusinessRequirementService/docs/superpowers/specs/2026-07-21-combined-status-api-spec.md`

---

## Summary

Replace `FAILED_UNKNOWN_TERMS` job status with `derivedStatus` field. `derivedStatus` combines raw job status with knowledge-gap info into four terminal states: `SUCCESS` (green), `SUCCESS_WITH_UNKNOWN` (amber), `FAILED` (red), `FAILED_WITH_UNKNOWN` (red). `SUCCESS_WITH_UNKNOWN` allows the user to proceed — the job succeeded but had knowledge gaps, and the user can choose to continue despite them.

---

## Motivation

The old `FAILED_UNKNOWN_TERMS` status was always a hard block, even when the agent successfully produced output despite some unresolved terms. The new model distinguishes between:

- **Success with gaps** (amber warning, proceed allowed) — the agent produced valid rules but couldn't resolve some terms
- **Failure with gaps** (red block) — the agent failed AND had missing terms

This gives users more control: they can review knowledge gaps and decide whether to proceed or fix the knowledge base first.

---

## Backend Contract (from parent spec)

### `derivedStatus` values

| derivedStatus | Meaning | GUI treatment |
|---|---|---|
| `SUCCESS` | Job succeeded, all terms resolved | Green StatusPill |
| `SUCCESS_WITH_UNKNOWN` | Job succeeded but some terms not found in KB | Amber StatusPill + unknown terms modal |
| `FAILED` | Job failed for non-knowledge reasons | Red StatusPill |
| `FAILED_WITH_UNKNOWN` | Job failed AND terms not found in KB | Red StatusPill + unknown terms modal |
| `QUEUED` / `RUNNING` | In progress | Blue StatusPill |

### Type changes

**`AsyncJob`** — new optional field:
```ts
export type AsyncJob = {
  // ... existing fields ...
  derivedStatus?: string | null   // NEW
}
```

**`JobTraceSummary`** — new field `derivedStatus: string`

**`WorkflowTraceAggregate`** — new fields `successWithUnknownJobs: number`, `failedWithUnknownJobs: number`

**`JobTraceResponse`** — new field `derivedStatus: string`

---

## File Changes

### 1. `src/api.ts` — Type updates

Add `derivedStatus` to `JobTraceSummary`:
```ts
export type JobTraceSummary = {
  id: string
  jobType: string
  status: string
  derivedStatus: string       // NEW
  errorMessage?: string | null
  createdAt: string
}
```

Add `derivedStatus` to `JobTraceResponse`:
```ts
export type JobTraceResponse = {
  job: AsyncJob
  derivedStatus: string        // NEW
  workflow?: WorkflowTraceRecord | null
  agentSessions: AgentTrace[]
  unscopedLlmCalls: LlmCallTrace[]
}
```

Add aggregate fields:
```ts
export type WorkflowTraceAggregate = {
  totalJobs: number
  failedJobs: number
  successWithUnknownJobs: number   // NEW
  failedWithUnknownJobs: number    // NEW
  hasUnknownTerms: boolean
}
```

---

### 2. `src/components/ui.tsx` — StatusPill

Add new statuses and remove `FAILED_UNKNOWN_TERMS`:

```ts
export function StatusPill({ value }: { value?: string | null }) {
  const normalized = value || 'UNKNOWN'
  const style =
    normalized === 'SUCCEEDED' || normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PASSED' || normalized === 'Transformed' || normalized === 'ACTIVE' || normalized === 'SUCCESS'
      ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]'
      : normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'BLOCKED' || normalized === 'ERROR' || normalized === 'Transform Failed' || normalized === 'FAILED_WITH_UNKNOWN'
        ? 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]'
        : normalized === 'PARTIAL_SUCCESS' || normalized === 'WARNED' || normalized === 'SUCCESS_WITH_UNKNOWN'
          ? 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]'
          : normalized === 'RUNNING' || normalized === 'PROCESSING' || normalized === 'QUEUED' || normalized === 'DRAFT' || normalized === 'Transforming' || normalized === 'INGESTING'
            ? 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]'
            : normalized === 'Uploaded'
              ? 'border-[#d8c4f7] bg-[#f5f0ff] text-[#6b21a8]'
              : 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]'
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', style)}>{normalized}</span>
}
```

Changes:
- Green group: add `SUCCESS`
- Red group: replace `FAILED_UNKNOWN_TERMS` with `FAILED_WITH_UNKNOWN`; keep `FAILED_UNKNOWN_TERMS` temporarily for backward compat during rollout
- Amber group: add `SUCCESS_WITH_UNKNOWN`

---

### 3. `src/pages/TraceLogsPage.tsx` — Derived status display

**Aggregate bar** — add new aggregate badges alongside the existing total/failed counts:

- **Amber badge** when `successWithUnknownJobs > 0`: "N with knowledge gaps" — shows count of jobs that succeeded but had unknown terms
- **Red badge** when `failedWithUnknownJobs > 0`: "N failed + gaps" — shows count of jobs that failed with unknown terms
- The existing "Knowledge Gaps" badge (tied to `hasUnknownTerms`) is **removed** — it's redundant since the count badges already signal the same information with more precision

**JobRow** — switch from raw `status` to `derivedStatus` for display:

```ts
const derived = job.derivedStatus
const isFailed = derived === 'FAILED' || derived === 'FAILED_WITH_UNKNOWN'
const hasUnknownTerms = derived === 'SUCCESS_WITH_UNKNOWN' || derived === 'FAILED_WITH_UNKNOWN'
```

The `StatusPill` in the row uses `derivedStatus` instead of `status`. The red left border only applies to `FAILED`/`FAILED_WITH_UNKNOWN`. `SUCCESS_WITH_UNKNOWN` rows show an amber `AlertTriangle` icon.

**Agent session** — unchanged. `session.finalStatus` remains the raw `FAILED_UNKNOWN_TERMS` from the agent (the backend doesn't change this). The unknown terms display within agent sessions is unaffected.

---

### 4. `src/pages/SemanticStagePage.tsx` — Stage job handling

Replace the `FAILED_UNKNOWN_TERMS` branch in the job polling `useEffect`:

**New branches:**

```ts
// SUCCESS_WITH_UNKNOWN: job succeeded, show warning + unknown terms, allow proceeding
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
  // Re-run maker creates a new workflow — navigate to it
  if (job.jobType === 'SEMANTIC_MAKER' && job.workflowId && job.workflowId !== workflowId) {
    setWorkflowId(job.workflowId)
    navigate(`/workflows/${encodeURIComponent(job.workflowId)}/semantic`)
  }
}

// FAILED_WITH_UNKNOWN: hard failure + knowledge gaps
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

Key difference from old behavior: `SUCCESS_WITH_UNKNOWN` invalidates queries (allowing the UI to update rule results) and proceeds normally. The user sees the unknown terms modal as a warning, not a blocker.

Fallback: temporarily keep `job.status === 'FAILED_UNKNOWN_TERMS'` check for backward compat during rollout. Treat it the same as `SUCCESS_WITH_UNKNOWN` (amber, proceed allowed).

---

### 5. `src/pages/AtomicStagePage.tsx` — Stage job handling

Same pattern as SemanticStagePage:

```ts
if (job.derivedStatus === 'SUCCESS_WITH_UNKNOWN' || job.status === 'FAILED_UNKNOWN_TERMS') {
  toast.warning(`${formatJobType(job.jobType)} completed with knowledge gaps`)
  traceLogsApi.getByJobId(job.id).then((trace) => { ... })
  window.setTimeout(complete, 0)
  void queryClient.invalidateQueries()
}

if (job.derivedStatus === 'FAILED_WITH_UNKNOWN') {
  toast.error(job.errorMessage || `${formatJobType(job.jobType)} failed with knowledge gaps`)
  traceLogsApi.getByJobId(job.id).then((trace) => { ... })
  window.setTimeout(complete, 0)
}
```

**Job row button** — update the "View unknown terms" button in the jobs table:

```ts
{(job.derivedStatus === 'SUCCESS_WITH_UNKNOWN' || job.derivedStatus === 'FAILED_WITH_UNKNOWN' || job.status === 'FAILED_UNKNOWN_TERMS') ? (
  <button onClick={...} title="View unknown terms">
    <AlertTriangle className="h-4 w-4 text-amber-600" />
    Unknown terms
  </button>
) : null}
```

**LlmTraceButton modal** — update the session unknown terms check from `finalStatus === 'FAILED_UNKNOWN_TERMS'` to also show for success sessions that have unknown terms (the session's `finalStatus` may still be `FAILED_UNKNOWN_TERMS` internally).

---

### 6. Helper functions — `isJobDone`

Update `isJobDone` to handle the transition period:

```ts
export function isJobDone(status?: string | null) {
  const normalized = normalizeJobStatus(status)
  return normalized === 'SUCCEEDED' || normalized === 'FAILED' || normalized === 'PARTIAL_SUCCESS' || normalized === 'FAILED_UNKNOWN_TERMS'
}
```

This ensures polled jobs with the old raw status are recognized as done during rollout.

---

## States

### StatusPill mappings

| derivedStatus | Pill color |
|---|---|
| `SUCCESS` | Green |
| `SUCCESS_WITH_UNKNOWN` | Amber |
| `FAILED` | Red |
| `FAILED_WITH_UNKNOWN` | Red |
| `QUEUED` / `RUNNING` | Blue |

### Stage page behavior per derivedStatus

| derivedStatus | Toast | Unknown terms modal | Proceed gate | Query invalidation |
|---|---|---|---|---|
| `SUCCESS` | Green success | No | Allowed | Yes |
| `SUCCESS_WITH_UNKNOWN` | Amber warning | Yes (auto-open) | **Allowed** | Yes |
| `FAILED` | Red error | No | Blocked | No |
| `FAILED_WITH_UNKNOWN` | Red error | Yes (auto-open) | Blocked | No |

### TraceLogsPage job row per derivedStatus

| derivedStatus | Left border | StatusPill | Badge icon |
|---|---|---|---|
| `SUCCESS` | None | Green | None |
| `SUCCESS_WITH_UNKNOWN` | None | Amber | Amber AlertTriangle |
| `FAILED` | Red border | Red | None |
| `FAILED_WITH_UNKNOWN` | Red border | Red | Amber AlertTriangle |
| `QUEUED`/`RUNNING` | None | Blue | None |

---

## Backward Compatibility

During rollout, some jobs may still have raw `status === 'FAILED_UNKNOWN_TERMS'` without `derivedStatus`. The stage pages handle this with a fallback check: `job.derivedStatus === 'SUCCESS_WITH_UNKNOWN' || job.status === 'FAILED_UNKNOWN_TERMS'`. Once the backend is fully migrated, the fallback can be removed.

The trace aggregate `hasUnknownTerms` field is unchanged and still works as a top-level signal.

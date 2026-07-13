# Unknown Terms Fail-Fast UI — Frontend Design Spec

**Date:** 2026-07-13
**Status:** Draft
**BE Spec:** `C:\Work\Workspace\hkex\BusinessRequirementService\docs\superpowers\specs\2026-07-13-unknown-terms-api-spec.md`

## 1. Background

When an agent (maker or checker) encounters business terms it cannot resolve through the knowledge base, the session now fails fast with `FAILED_UNKNOWN_TERMS` status. The `AgentTraceResponse` now includes an `unknownTerms: UnknownTerm[]` field listing the exact queries that could not be resolved.

The frontend must detect this condition in the main workflow (Semantic and Atomic stage pages) and surface the missing terms to the user with clear action paths.

## 2. API Contract Summary

### 2.1 New type: UnknownTerm

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | The exact search query sent to the research tool |
| `reason` | string | Why it could not be resolved (e.g. "Not found in knowledge base") |

### 2.2 Updated: AgentTraceResponse

| Field | Type | Change |
|-------|------|--------|
| `session` | `LlmAgentSession` | Unchanged |
| `llmCalls` | `LlmCallTrace[]` | Unchanged |
| `unknownTerms` | `UnknownTerm[]` | **New.** Always present; `[]` when all terms found or no research performed |

### 2.3 New session status

`session.finalStatus` may now be `FAILED_UNKNOWN_TERMS`. This is distinct from `FAILED` (generic infrastructure failure) — it specifically means knowledge is missing.

### 2.4 Backward compatibility

- `unknownTerms` is always present on `AgentTraceResponse` — if absent from older API version, treat as `[]`
- The job status `FAILED_UNKNOWN_TERMS` only appears for new sessions

## 3. UI Design

### 3.1 Overview

Two display modes, both present:

- **Modal (auto-open):** When a job's status transitions to `FAILED_UNKNOWN_TERMS`, the stage page fetches the trace and opens a modal listing the missing terms.
- **Inline row expansion (persistent):** The failed job's row in the jobs table shows a "⚠ Terms" button. Clicking it expands the row showing the same terms list inline.

### 3.2 UnknownTermsModal component

A modal overlay following the existing `JsonDrawer` pattern (backdrop + slide-in panel from center). Shared component used by both stage pages.

**Props:**
- `unknownTerms: UnknownTerm[]`
- `onClose: () => void`
- `onUploadDocs: () => void` — navigates to `/knowledge-base`
- `onRetry: () => void` — re-triggers the failed job

**Layout:**

```
┌─ ⚠ Knowledge Gap Detected ───────────────────────── ✕ ─┐
│                                                          │
│  [Job type] job failed — N terms not found in knowledge  │
│  base. Upload documents covering these topics, then       │
│  retry.                                                   │
│                                                          │
│  Missing terms (N):                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ • query text                                        │  │
│  │   reason text                                       │  │
│  │ • query text                                        │  │
│  │   reason text                                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│       [📄 Upload Knowledge Documents]  [🔄 Retry]        │
└──────────────────────────────────────────────────────────┘
```

**Color scheme:** Red border/banner (`#f7b4ae`/`#fff1f0`/`#b42318`) to match the error state.

### 3.3 Inline row expansion (AtomicStagePage)

In the stage jobs table, a job row with `FAILED_UNKNOWN_TERMS` shows:
- StatusPill: `FAILED_UNKNOWN_TERMS` (red)
- Actions: standard action buttons + new "⚠ Terms" button

Clicking "⚠ Terms" expands the row using the same Fragment pattern as the KB page outline rows, showing the same terms list inline (not modal). The terms are stored after the first trace fetch so repeated expanding doesn't re-fetch.

### 3.4 SemanticStagePage changes

In the job status `useEffect` handler, add a new branch for `FAILED_UNKNOWN_TERMS`:
- Do NOT clear `activeJobId` (unlike SUCCEEDED/FAILED — the user needs to see the terms)
- Fetch the trace via `traceLogsApi.getByJobId(job.id)`
- Extract `unknownTerms` from all agent sessions
- Open `UnknownTermsModal` with the terms
- "Retry" dispatches the same maker job type again

### 3.5 AtomicStagePage changes

Same `useEffect` change as SemanticStagePage, plus:
- The jobs table renders "⚠ Terms" button on FAILED_UNKNOWN_TERMS rows
- Terms data cached in component state after first fetch
- The existing `LlmTraceButton` drawer also shows unknown terms in the session section

### 3.6 TraceLogsPage changes

In the agent session display (around line 1751), when `session.finalStatus === 'FAILED_UNKNOWN_TERMS'` and `unknownTerms.length > 0`, show a section listing the missing terms below the session header. Uses the same chip/tag styling.

## 4. Type Definitions

```ts
// New type
export type UnknownTerm = {
  query: string
  reason: string
}

// Updated AgentTrace
export type AgentTrace = {
  session: LlmAgentSession
  llmCalls: LlmCallTrace[]
  unknownTerms: UnknownTerm[]  // new field
}
```

## 5. Files

| File | Action | Description |
|------|--------|-------------|
| `src/api.ts` | Modify | Add `UnknownTerm` type; update `AgentTrace` |
| `src/components/ui.tsx` | Modify | Add `FAILED_UNKNOWN_TERMS` to StatusPill red group |
| `src/components/UnknownTermsModal.tsx` | Create | Shared modal component: terms list + upload/retry actions |
| `src/pages/SemanticStagePage.tsx` | Modify | Handle `FAILED_UNKNOWN_TERMS` in job useEffect |
| `src/pages/AtomicStagePage.tsx` | Modify | Handle in useEffect + inline row expansion + trace drawer |
| `src/pages/TraceLogsPage.tsx` | Modify | Show unknown terms in agent session display |

6 files: 1 create, 5 modify.

## 6. Verification

- `npm run lint` — zero new errors in touched files
- `npm run build` — zero errors from touched files
- `npm test` — 19 existing vitest tests still pass
- Manual smoke: trigger a maker job against a document with terms not in the KB; verify modal opens with term list; verify "⚠ Terms" row button works; verify "Upload Docs" navigates to /knowledge-base

## 7. Out of Scope

- Auto-suggesting which documents to upload
- Batch-retry of multiple failed jobs
- Any changes to the job submission API
- Parsing unknown terms from `finalValidationMessage` string (BE provides structured `unknownTerms` array)

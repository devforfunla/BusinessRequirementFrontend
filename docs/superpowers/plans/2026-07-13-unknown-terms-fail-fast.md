# Unknown Terms Fail-Fast UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface unknown terms from failed maker/checker jobs with a modal and inline row expansion, directing users to upload knowledge documents before retrying.

**Architecture:** Add `UnknownTerm` type and update `AgentTrace` in `api.ts`. Create a shared `UnknownTermsModal` component (modal overlay + terms list + Upload Docs + Retry actions). Wire it into `SemanticStagePage` and `AtomicStagePage` job status handlers. Add inline row expansion with "Terms" button in `AtomicStagePage` jobs table. Extend `TraceLogsPage` agent session display. Extend `StatusPill` for the new status value.

**Tech Stack:** React 19, TypeScript (verbatimModuleSyntax, erasableSyntaxOnly, noUnusedLocals/Parameters), TanStack Query 5, existing UI components, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-13-unknown-terms-fail-fast-frontend-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/api.ts` | Modify | Add `UnknownTerm` type; add `unknownTerms` field to `AgentTrace` |
| `src/components/ui.tsx` | Modify | Add `FAILED_UNKNOWN_TERMS` to StatusPill red group |
| `src/components/UnknownTermsModal.tsx` | Create | Shared modal: terms list + upload/retry action buttons |
| `src/pages/SemanticStagePage.tsx` | Modify | Handle `FAILED_UNKNOWN_TERMS` in job useEffect, fetch trace, open modal |
| `src/pages/AtomicStagePage.tsx` | Modify | Same useEffect + inline row expansion in jobs table |
| `src/pages/TraceLogsPage.tsx` | Modify | Show unknown terms in agent session display |

6 files: 1 create, 5 modify.

---

## Conventions

- **TypeScript strictness:** `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `noUnusedLocals`/`noUnusedParameters`
- **Verification:** `npm run lint && npm run build && npm test` before each commit. (vitest is configured on this branch, 19 tests pass.)
- **Commits:** Conventional Commits. End with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`

---

## Task 1: Add UnknownTerm type and update AgentTrace

**Files:**
- Modify: `src/api.ts`

- [ ] **Step 1: Add type and update AgentTrace**

READ `src/api.ts` around line 583 to find the current `AgentTrace` type. Insert `UnknownTerm` before it, then add `unknownTerms` to `AgentTrace`:

```ts
export type UnknownTerm = {
  query: string
  reason: string
}

export type AgentTrace = {
  session: LlmAgentSession
  llmCalls: LlmCallTrace[]
  unknownTerms: UnknownTerm[]
}
```

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: may show type errors in pages that destructure `AgentTrace` without `unknownTerms` — expected breakage, Tasks 4-6 will fix.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "$(cat <<'EOF'
feat: add UnknownTerm type and update AgentTrace

Adds UnknownTerm type and unknownTerms field to AgentTrace to match
the BE's new fail-fast response shape. Always present, empty array
when all terms resolved.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend StatusPill for FAILED_UNKNOWN_TERMS

**Files:**
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Add to red group**

READ `src/components/ui.tsx` around lines 217-232 to find the `StatusPill` function. Add `|| normalized === 'FAILED_UNKNOWN_TERMS'` to the red group (alongside `FAILED`, `REJECTED`, `BLOCKED`, `ERROR`, `Transform Failed`).

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run build && npm test`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add FAILED_UNKNOWN_TERMS to StatusPill red group

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create UnknownTermsModal component

**Files:**
- Create: `src/components/UnknownTermsModal.tsx`

- [ ] **Step 1: Read reference pattern**

READ `src/components/ui.tsx` for the `JsonDrawer` component (around lines 292-333). `UnknownTermsModal` follows the same overlay pattern (backdrop + centered panel).

- [ ] **Step 2: Create the component**

Create `src/components/UnknownTermsModal.tsx`:

```tsx
import { AlertTriangle, Upload, RefreshCw, X } from 'lucide-react'
import type { UnknownTerm } from '../api'
import { Button } from './ui'

export function UnknownTermsModal({
  jobType,
  unknownTerms,
  onClose,
  onUploadDocs,
  onRetry,
}: {
  jobType: string
  unknownTerms: UnknownTerm[]
  onClose: () => void
  onUploadDocs: () => void
  onRetry: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#101828]/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-[600px] flex-col rounded-lg border border-[#f7b4ae] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#f7b4ae] bg-[#fff1f0] px-5 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#b42318]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#b42318]">Knowledge Gap Detected</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[#b42318] hover:bg-[#fde8e8] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          <p className="text-sm text-[#475467]">
            <strong className="text-[#172033]">{jobType}</strong> job failed —{' '}
            {unknownTerms.length} term{unknownTerms.length === 1 ? '' : 's'} could not be found in
            the knowledge base. Upload documents covering these topics, then retry.
          </p>

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase text-[#667085]">
              Missing terms ({unknownTerms.length})
            </h3>
            <div className="mt-2 max-h-64 overflow-auto rounded-md border border-[#e3e8f0] bg-[#f8fafc]">
              {unknownTerms.map((term, i) => (
                <div
                  key={i}
                  className="border-b border-[#e3e8f0] px-4 py-2.5 last:border-0"
                >
                  <p className="text-sm font-medium text-[#172033]">{term.query}</p>
                  <p className="mt-0.5 text-xs text-[#98a2b3]">{term.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="flex justify-end gap-3 border-t border-[#e3e8f0] bg-[#f8fafc] px-5 py-3">
          <Button variant="secondary" onClick={onUploadDocs}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload Knowledge Documents
          </Button>
          <Button variant="primary" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry Extraction
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`

- [ ] **Step 4: Commit**

```bash
git add src/components/UnknownTermsModal.tsx
git commit -m "$(cat <<'EOF'
feat: add UnknownTermsModal component

Shared modal for displaying knowledge gap terms with Upload Docs
and Retry Extraction action buttons. Used by Semantic and Atomic
stage pages when a job fails with FAILED_UNKNOWN_TERMS.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire UnknownTermsModal into SemanticStagePage

**Files:**
- Modify: `src/pages/SemanticStagePage.tsx`

**Context:** SemanticStagePage at ~line 152-173 has a `useEffect` watching `jobQuery.data.status`. Currently handles `SUCCEEDED`, `PARTIAL_SUCCESS`, and `FAILED`. Need to add `FAILED_UNKNOWN_TERMS`.

- [ ] **Step 1: Read the current file**

READ `src/pages/SemanticStagePage.tsx` lines 1-30 (imports) and lines 145-175 (job useEffect).

- [ ] **Step 2: Add imports and state**

Add imports:
```tsx
import { useNavigate } from 'react-router-dom'
import { getErrorMessage, traceLogsApi, type UnknownTerm } from '../api'
import { UnknownTermsModal } from '../components/UnknownTermsModal'
```

(Check if `useNavigate` and `getErrorMessage` are already imported — they likely are. Only add what's missing.)

Add state near other useState declarations:
```tsx
const [unknownTerms, setUnknownTerms] = useState<{ jobType: string; terms: UnknownTerm[] } | null>(null)
```

- [ ] **Step 3: Add FAILED_UNKNOWN_TERMS case in useEffect**

In the existing `useEffect` at line 152, after the `FAILED` case, add:

```tsx
    if (job.status === 'FAILED_UNKNOWN_TERMS') {
      // Fetch trace to get unknown terms — do NOT clear activeJobId
      traceLogsApi.getByJobId(job.id).then((trace) => {
        const allTerms = trace.agentSessions.flatMap((s) => s.unknownTerms)
        if (allTerms.length > 0) {
          setUnknownTerms({ jobType: job.jobType, terms: allTerms })
        }
      }).catch(() => {
        toast.error('Failed to load unknown terms')
      })
    }
```

Key: does NOT clear `activeJobId` (unlike SUCCEEDED/FAILED). The user needs to see the terms before dismissing.

- [ ] **Step 4: Render the modal**

Add at the bottom of the return JSX (before the closing tag), next to where other modals might be:

```tsx
      {unknownTerms ? (
        <UnknownTermsModal
          jobType={unknownTerms.jobType}
          unknownTerms={unknownTerms.terms}
          onClose={() => setUnknownTerms(null)}
          onUploadDocs={() => {
            setUnknownTerms(null)
            navigate('/knowledge-base')
          }}
          onRetry={() => {
            setUnknownTerms(null)
            // Re-trigger the same maker job type
            // The existing maker mutation dispatch logic varies by tab
          }}
        />
      ) : null}
```

Note: The `onRetry` handler needs to dispatch the same maker job. Look at how the page triggers maker jobs (likely a `mutate()` call on a mutation). If the page has a `makerMutation` or similar, call `makerMutation.mutate()` with the appropriate params. READ the file to find the correct mutation.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build && npm test`

- [ ] **Step 6: Commit**

```bash
git add src/pages/SemanticStagePage.tsx
git commit -m "$(cat <<'EOF'
feat: handle FAILED_UNKNOWN_TERMS in SemanticStagePage

When a semantic maker/checker job fails with unknown terms, fetches
the trace and opens UnknownTermsModal. User can navigate to upload
knowledge documents or retry the extraction.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire into AtomicStagePage (modal + inline row)

**Files:**
- Modify: `src/pages/AtomicStagePage.tsx`

**Context:** Same pattern as SemanticStagePage (job useEffect at ~line 180-207), plus:
- Inline row expansion for "Terms" button in the jobs table
- The existing `LlmTraceButton` drawer shows unknown terms in session display

- [ ] **Step 1: Read the current file**

READ the relevant sections of `src/pages/AtomicStagePage.tsx`:
- Imports (lines 1-55)
- Job useEffect (lines 180-207)
- Jobs table rendering (find the table that renders `stageJobs`)

- [ ] **Step 2: Add imports and state**

Add the same imports as Task 4:
```tsx
import { UnknownTermsModal } from '../components/UnknownTermsModal'
```

Add state:
```tsx
const [unknownTerms, setUnknownTerms] = useState<{ jobType: string; terms: UnknownTerm[] } | null>(null)
const [expandedTermsJobId, setExpandedTermsJobId] = useState<string | null>(null)
// Cache unknown terms by job ID to avoid re-fetching for row expansion
const [termsCache, setTermsCache] = useState<Record<string, UnknownTerm[]>>({})
```

- [ ] **Step 3: Add FAILED_UNKNOWN_TERMS case in useEffect**

Same pattern as Task 4. In the existing useEffect at line 180, add after the `FAILED` case:

```tsx
    if (job.status === 'FAILED_UNKNOWN_TERMS') {
      traceLogsApi.getByJobId(job.id).then((trace) => {
        const allTerms = trace.agentSessions.flatMap((s) => s.unknownTerms)
        if (allTerms.length > 0) {
          setTermsCache((prev) => ({ ...prev, [job.id]: allTerms }))
          setUnknownTerms({ jobType: job.jobType, terms: allTerms })
        }
      }).catch(() => {
        toast.error('Failed to load unknown terms')
      })
      window.setTimeout(complete, 0)
    }
```

- [ ] **Step 4: Add "Terms" button in jobs table**

In the jobs table, find the Actions column. For each job row, add next to existing buttons:

```tsx
{job.status === 'FAILED_UNKNOWN_TERMS' ? (
  <Button
    size="sm"
    variant="danger"
    title="View unknown terms"
    onClick={async (e) => {
      e.stopPropagation()
      if (expandedTermsJobId === job.id) {
        setExpandedTermsJobId(null)
      } else {
        if (!termsCache[job.id]) {
          // Fetch trace if not cached
          try {
            const trace = await traceLogsApi.getByJobId(job.id)
            const allTerms = trace.agentSessions.flatMap((s) => s.unknownTerms)
            setTermsCache((prev) => ({ ...prev, [job.id]: allTerms }))
          } catch { /* ignore */ }
        }
        setExpandedTermsJobId(job.id)
      }
    }}
  >
    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
    Terms
  </Button>
) : null}
```

- [ ] **Step 5: Add inline row expansion**

Using the Fragment pattern (same as KnowledgeBasePage outline rows), wrap each job `<tr>` with `<Fragment key={job.id}>` and add a conditional expanded row:

```tsx
{expandedTermsJobId === job.id && termsCache[job.id] ? (
  <tr>
    <td colSpan={8} className="border-b border-[#f7b4ae] bg-[#fffcfc] px-4 py-3">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#b42318]">
          Missing terms ({termsCache[job.id].length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {termsCache[job.id].map((term, i) => (
            <span
              key={i}
              className="rounded border border-[#f7b4ae] bg-[#fff1f0] px-2 py-0.5 text-xs text-[#b42318]"
              title={term.reason}
            >
              {term.query}
            </span>
          ))}
        </div>
      </div>
    </td>
  </tr>
) : null}
```

- [ ] **Step 6: Update LlmTraceButton drawer**

In the `LlmTraceButton` component (around line 1721), the session header currently shows:
```tsx
Session #{si + 1} — {s.session.finalStatus} — {s.session.totalTokens ?? 0} tokens
```

After this header, add the unknown terms section when present (same code as Task 6). This is separate from the TraceLogsPage change — `LlmTraceButton` is an independent inline component.

```tsx
{s.session.finalStatus === 'FAILED_UNKNOWN_TERMS' && s.unknownTerms.length > 0 ? (
  <div className="mb-3 rounded-md border border-[#f7b4ae] bg-[#fff1f0] px-3 py-2">
    <p className="text-xs font-semibold text-[#b42318]">
      Missing terms ({s.unknownTerms.length})
    </p>
    <div className="mt-1.5 flex flex-wrap gap-1">
      {s.unknownTerms.map((term, i) => (
        <span key={i} className="rounded border border-[#f7b4ae] bg-white px-1.5 py-0.5 text-xs text-[#b42318]" title={term.reason}>
          {term.query}
        </span>
      ))}
    </div>
  </div>
) : null}
```

- [ ] **Step 7: Render the modal**

Same as Task 4 — add at the bottom of the JSX.

- [ ] **Step 8: Verify**

Run: `npm run lint && npm run build && npm test`

- [ ] **Step 9: Commit**

```bash
git add src/pages/AtomicStagePage.tsx
git commit -m "$(cat <<'EOF'
feat: handle FAILED_UNKNOWN_TERMS in AtomicStagePage

Opens UnknownTermsModal when a job fails with unknown terms. Adds
"Terms" button and inline row expansion in the jobs table. Caches
terms per job ID to avoid re-fetching trace data.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Show unknown terms in TraceLogsPage

**Files:**
- Modify: `src/pages/TraceLogsPage.tsx`

- [ ] **Step 1: Read the current file**

READ `src/pages/TraceLogsPage.tsx` around lines 119-155 (agent session rendering) to see where `agentTrace.session` and `agentTrace.llmCalls` are rendered.

- [ ] **Step 2: Add unknown terms section**

After the `finalValidationMessage` block (around line 148) and before `<LlmCalls calls={agentTrace.llmCalls} />`, add:

```tsx
{agentTrace.session.finalStatus === 'FAILED_UNKNOWN_TERMS' && agentTrace.unknownTerms.length > 0 ? (
  <div className="rounded-md border border-[#f7b4ae] bg-[#fff1f0] px-4 py-3">
    <h4 className="text-sm font-semibold text-[#b42318]">
      Knowledge Gap — {agentTrace.unknownTerms.length} term{agentTrace.unknownTerms.length === 1 ? '' : 's'}
    </h4>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {agentTrace.unknownTerms.map((term, i) => (
        <span
          key={i}
          className="rounded border border-[#f7b4ae] bg-white px-2 py-0.5 text-xs text-[#b42318]"
          title={term.reason}
        >
          {term.query}
        </span>
      ))}
    </div>
  </div>
) : null}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build && npm test`

- [ ] **Step 4: Commit**

```bash
git add src/pages/TraceLogsPage.tsx
git commit -m "$(cat <<'EOF'
feat: show unknown terms in TraceLogsPage agent sessions

Displays a red alert panel with term chips when an agent session has
FAILED_UNKNOWN_TERMS status and non-empty unknownTerms.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Full lint, build, tests**

Run: `npm run lint && npm run build && npm test`
Expected: only pre-existing errors in other files. 19 tests pass.

- [ ] **Step 2: Manual smoke**

Prerequisites: BE on 8082 with unknown terms support. A workflow with a maker job that triggers research calls against a document with terms not in the KB.

1. Trigger a maker job on the Atomic stage
2. Verify modal opens when job transitions to FAILED_UNKNOWN_TERMS
3. Verify terms list is readable with query + reason
4. Click "Upload Knowledge Documents" → navigates to /knowledge-base
5. Close modal, click "Terms" button on the job row → verify inline expansion
6. Click "Terms" again → row collapses
7. Open TraceLogsPage for the same job → verify terms appear in session display
8. Verify StatusPill shows FAILED_UNKNOWN_TERMS in red

---

## Notes for the implementer

- **Trace fetch is needed** — the job status tells you `FAILED_UNKNOWN_TERMS`, but the `unknownTerms` array is only in the trace response. Fetch `traceLogsApi.getByJobId(job.id)` to get the terms.
- **Don't create a new axios client** — `traceLogsApi` already exists in `api.ts`.
- **`unknownTerms` on `AgentTrace`** — it's at the `AgentTrace` level (sibling of `session`), NOT inside `LlmAgentSession`. Access as `agentTrace.unknownTerms`, not `agentTrace.session.unknownTerms`.
- **Retry logic** — the `onRetry` handler needs to dispatch the same maker job mutation. In SemanticStagePage, find the appropriate mutation for the active tab (maker/rewrite). In AtomicStagePage, find the atomic maker mutation. If the mutation requires specific params, pass them.
- **Terms cache in AtomicStagePage** — use a `Record<string, UnknownTerm[]>` state to avoid re-fetching the trace every time the user toggles the inline row.

# Tool Call Audit Sources Citation Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display research source citations in the trace logs page when `sourcesJson` is present on a `ToolCallAudit`.

**Architecture:** Add a `sourcesJson` field to the `ToolCallAudit` type in `api.ts`, create a shared `SourcesList` component in `ui.tsx` that parses and renders citations, and integrate it into `TraceLogsPage.tsx` below each tool call's response.

**Tech Stack:** React 19 + TypeScript + Tailwind v4 + Lucide icons

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/api.ts:583-598` | Modify | Add `sourcesJson?: string \| null` field to `ToolCallAudit` type |
| `src/components/ui.tsx` | Modify | New `SourcesList` component — parse, format, render citation list |
| `src/pages/TraceLogsPage.tsx:225-239` | Modify | Import and render `<SourcesList>` inside tool call details |

---

### Task 1: Add `sourcesJson` field to `ToolCallAudit` type

**Files:**
- Modify: `src/api.ts:583-598`

- [ ] **Step 1: Add the field**

Insert after `responseJson` (line 593):

```typescript
  sourcesJson?: string | null
```

The type should read:

```typescript
export type ToolCallAudit = {
  id: string
  agentSessionId?: string | null
  llmCallId?: string | null
  workflowId?: string | null
  jobId?: string | null
  jobType: string
  iterationRound?: number | null
  toolName: string
  requestJson: string
  responseJson?: string | null
  sourcesJson?: string | null
  status: string
  durationMs?: number | null
  errorMessage?: string | null
  createdAt: string
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: add sourcesJson field to ToolCallAudit type"
```

---

### Task 2: Create `SourcesList` component in `ui.tsx`

**Files:**
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Add `Info` to lucide-react import**

At line 3, add `Info` to the import:

```typescript
import { AlertCircle, Inbox, Info, X } from 'lucide-react'
```

- [ ] **Step 2: Add `SourcesList` component**

Add below the existing `JsonBlock` component (around line 261). Insert after the closing `}` of `JsonBlock`:

```typescript
type SourceEntry = {
  docId: number
  docName?: string | null
  sectionId: number
  title?: string | null
  level?: number | null
  path?: string | null
  referredFromSectionId?: number | null
  referredFromDocName?: string | null
  referredFromPath?: string | null
  reason?: string | null
}

function formatSourceCitation(source: SourceEntry, index: number): string {
  const doc = source.docName ?? `Document ${source.docId}`
  const loc = source.path ? `§${source.path}` : `(section ${source.sectionId})`
  const title = source.title ? ` — ${source.title}` : ''
  const ref = formatReferenceChain(source)
  return `[${index + 1}] ${doc} ${loc}${title}${ref}`
}

function formatReferenceChain(source: SourceEntry): string {
  if (source.referredFromSectionId == null) return ''
  const doc =
    source.referredFromDocName ?? `Document ${source.referredFromSectionId}`
  const loc = source.referredFromPath
    ? `§${source.referredFromPath}`
    : `(section ${source.referredFromSectionId})`
  return ` (from ${doc} ${loc})`
}

function parseSources(sourcesJson?: string | null): SourceEntry[] | null {
  if (!sourcesJson) return null
  try {
    const parsed = JSON.parse(sourcesJson)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed as SourceEntry[]
  } catch (e) {
    console.warn('Failed to parse sourcesJson', e)
    return null
  }
}

export function SourcesList({ sourcesJson }: { sourcesJson?: string | null }) {
  const sources = parseSources(sourcesJson)
  if (!sources) return null

  return (
    <div className="mt-2 border-t border-[#e3e8f0] pt-2">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#667085]">
        Sources ({sources.length})
      </div>
      <ul className="space-y-0.5">
        {sources.map((source, i) => (
          <li
            key={source.sectionId}
            className="flex items-baseline gap-1 text-xs text-[#344054]"
          >
            <span className="font-medium text-[#1f6feb]">
              [{i + 1}]
            </span>
            <span>{formatSourceCitation(source, i)}</span>
            {source.reason ? (
              <span
                className="cursor-help text-[#98a2b3]"
                title={source.reason}
              >
                <Info size={12} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: no type errors, `SourcesList` exported from `ui.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui.tsx
git commit -m "feat: add SourcesList component for citation display"
```

---

### Task 3: Integrate `SourcesList` into `TraceLogsPage`

**Files:**
- Modify: `src/pages/TraceLogsPage.tsx:6,236`

- [ ] **Step 1: Import `SourcesList`**

At line 6, add `SourcesList` to the import from `../components/ui`:

```typescript
import { Button, EmptyState, ErrorNotice, JsonBlock, Label, PageTitle, Panel, PanelHeader, SourcesList, StatusPill, TextInput } from '../components/ui'
```

- [ ] **Step 2: Render `<SourcesList>` inside tool call details**

After line 236 (the `{tc.responseJson ? ... : null}` line), add:

```tsx
<SourcesList sourcesJson={tc.sourcesJson} />
```

The tool call rendering block should look like:

```tsx
<div className="space-y-2 border-t border-[#e3e8f0] p-3">
  {tc.errorMessage ? <ErrorNotice message={tc.errorMessage} /> : null}
  <PayloadDetails title="Request" value={tc.requestJson} />
  {tc.responseJson ? <PayloadDetails title="Response" value={tc.responseJson} /> : null}
  <SourcesList sourcesJson={tc.sourcesJson} />
</div>
```

- [ ] **Step 3: Verify build and lint pass**

Run: `npm run build && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TraceLogsPage.tsx
git commit -m "feat: show research sources in trace tool call details"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full build + lint**

Run: `npm run build && npm run lint`
Expected: both pass cleanly.

- [ ] **Step 2: Manual review of rendered output**

Run: `npm run dev` (requires backend on :8080)
Navigate to trace page with a job that has research tool calls.
Verify: sources footer appears with numbered citations, reference chains, and tooltip on hover.
Verify: non-research tool calls and old records show no sources footer.

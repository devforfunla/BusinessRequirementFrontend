# Outline Tree Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `OutlinePanel` from rendering flat `#sectionId` chips to a collapsible recursive tree with path/title/summary, matching the new `SectionTreeNode[]` outline response.

**Architecture:** Two files touched. `api.ts` gets the new recursive `SectionTreeNode` type replacing `KbSectionRef`. `KnowledgeBasePage.tsx` gets `OutlinePanel` rewritten with a file-private recursive `SectionNodeView`, collapse state via `Set<number>`, and polling via `refetchInterval` on `outlineQuery`. No new files.

**Tech Stack:** React 19 + TypeScript + TanStack Query 5 + Tailwind v4 + Lucide React

---

### Task 1: Update outline types in `src/api.ts`

**Files:**
- Modify: `src/api.ts:1135-1136`

- [ ] **Step 1: Replace `KbSectionRef` with `SectionTreeNode`**

Open `src/api.ts` and replace lines 1135-1136:

```typescript
export type KbSectionRef = { sectionId: number }
export type KbDocumentOutline = KbSectionRef[]
```

With:

```typescript
export interface SectionTreeNode {
  sectionId: number
  title: string | null
  level: number | null
  path: string | null
  summary: string | null
  children: SectionTreeNode[]
}

export type KbDocumentOutline = SectionTreeNode[]
```

- [ ] **Step 2: Run typecheck to confirm no downstream breakage yet**

Run: `npx tsc --noEmit --project tsconfig.app.json 2>&1 | head -20`

Expected: errors in `KnowledgeBasePage.tsx` only (OutlinePanel still references `sectionId` on what is now a `SectionTreeNode`). No errors anywhere else. This is expected — Task 2 fixes the consumer.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: replace KbSectionRef with recursive SectionTreeNode type"
```

---

### Task 2: Rewrite OutlinePanel with recursive tree

**Files:**
- Modify: `src/pages/KnowledgeBasePage.tsx:1-7` (imports), `src/pages/KnowledgeBasePage.tsx:45-50` (outlineQuery), `src/pages/KnowledgeBasePage.tsx:261-312` (OutlinePanel)

- [ ] **Step 1: Update imports (lines 1-7)**

Add `ChevronDown, ChevronRight` to the lucide-react import, add `SectionTreeNode` to the api type import, and add `cn` to the utils import.

Change line 3:
```typescript
import { Archive, Box, BookOpen, ChevronDown, ChevronRight, ListTree, RefreshCw, Trash2, Upload } from 'lucide-react'
```

Change line 5:
```typescript
import { getErrorMessage, knowledgeBaseApi, type KbDocument, type KbDocumentOutline, type KbDocumentStatus, type SectionTreeNode } from '../api'
```

Change line 6:
```typescript
import { cn, formatBytes, formatDate } from '../utils'
```

- [ ] **Step 2: Add `refetchInterval` to `outlineQuery` (lines 45-50)**

Replace:
```typescript
  const outlineQuery = useQuery({
    queryKey: ['kb-document-outline', expandedDocId],
    queryFn: () => knowledgeBaseApi.outline(expandedDocId!),
    enabled: expandedDocId !== null,
    staleTime: 60_000,
  })
```

With:
```typescript
  const outlineQuery = useQuery({
    queryKey: ['kb-document-outline', expandedDocId],
    queryFn: () => knowledgeBaseApi.outline(expandedDocId!),
    enabled: expandedDocId !== null,
    staleTime: 60_000,
    refetchInterval: (query) => {
      const tree = query.state.data as KbDocumentOutline | undefined
      return hasNullSummary(tree) ? 5000 : false
    },
  })
```

- [ ] **Step 3: Add helper functions after `STATUS_FILTER_OPTIONS` (before `KnowledgeBasePage`)**

Insert after line 18 (after the `STATUS_FILTER_OPTIONS` array):

```typescript
function countAllSections(tree: SectionTreeNode[]): number {
  let count = 0
  for (const node of tree) {
    count += 1
    count += countAllSections(node.children)
  }
  return count
}

function hasNullSummary(tree: KbDocumentOutline | undefined): boolean {
  if (!tree) return false
  for (const node of tree) {
    if (node.summary === null) return true
    if (hasNullSummary(node.children)) return true
  }
  return false
}
```

- [ ] **Step 4: Replace `OutlinePanel` (lines 261-312)**

Delete the entire old `OutlinePanel` function (lines 261-312) and replace with:

```typescript
function OutlinePanel({
  doc,
  outlineQuery,
}: {
  doc: KbDocument
  outlineQuery: UseQueryResult<KbDocumentOutline>
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())

  const toggleCollapse = (sectionId: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  if (doc.status !== 'active' && doc.status !== 'archived') {
    return (
      <p className="text-sm text-[#667085]">
        Outline is available only for active or archived documents.
      </p>
    )
  }
  if (outlineQuery.isPending) {
    return <p className="text-sm text-[#667085]">Loading outline…</p>
  }
  if (outlineQuery.isError) {
    return <ErrorNotice message={getErrorMessage(outlineQuery.error)} />
  }
  const tree = outlineQuery.data || []
  if (tree.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[#172033]">No sections created.</p>
        <p className="text-xs text-[#667085]">
          Ingestion produced zero sections. The source document may have been empty or unparseable.
        </p>
      </div>
    )
  }
  const totalSections = countAllSections(tree)
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#172033]">
        {totalSections} section{totalSections === 1 ? '' : 's'}, {tree.length} top-level heading{tree.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <SectionNodeView
            key={node.sectionId}
            node={node}
            collapsedIds={collapsedIds}
            toggleCollapse={toggleCollapse}
          />
        ))}
      </ul>
    </div>
  )
}

function SectionNodeView({
  node,
  collapsedIds,
  toggleCollapse,
}: {
  node: SectionTreeNode
  collapsedIds: Set<number>
  toggleCollapse: (id: number) => void
}) {
  const isCollapsed = collapsedIds.has(node.sectionId)
  const hasChildren = node.children.length > 0

  return (
    <li className="list-none">
      <div
        className={cn(
          'flex items-start gap-1 py-0.5',
          hasChildren && 'cursor-pointer',
        )}
        onClick={() => hasChildren && toggleCollapse(node.sectionId)}
      >
        {hasChildren ? (
          isCollapsed ? (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" aria-hidden="true" />
          ) : (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" aria-hidden="true" />
          )
        ) : (
          <span className="inline-block w-4 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            {node.path !== null && (
              <span className="shrink-0 text-xs text-[#667085]">{node.path}</span>
            )}
            <span className="text-sm font-medium text-[#172033]">
              {node.title ?? '(untitled)'}
            </span>
          </div>
          {node.summary !== null ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[#667085]">
              {node.summary}
            </p>
          ) : (
            <p className="mt-0.5 text-xs italic text-[#98a2b3]">Summary pending…</p>
          )}
        </div>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="pl-6">
          {node.children.map((child) => (
            <SectionNodeView
              key={child.sectionId}
              node={child}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/KnowledgeBasePage.tsx
git commit -m "feat: render outline as collapsible recursive tree with path/title/summary"
```

---

### Task 3: Verify build passes

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: zero errors, zero warnings.

- [ ] **Step 2: Run full build (typecheck + vite)**

Run: `npm run build`

Expected: `✓ built in Xs` (or similar success output). No type errors, no build errors.

- [ ] **Step 3: If either fails, fix and re-run**

Any lint/type errors in `KnowledgeBasePage.tsx` or `api.ts` — fix them, run the failing command again, then proceed.

- [ ] **Step 4: Commit (if fixes were needed)**

Only if changes were made in step 3:

```bash
git add src/pages/KnowledgeBasePage.tsx src/api.ts
git commit -m "fix: lint/type errors from outline tree migration"
```

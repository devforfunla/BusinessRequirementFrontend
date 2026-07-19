# Outline Tree Redesign — Design Spec

**Date:** 2026-07-19
**Trigger:** `GET /api/documents/{id}/outline` changed from flat `{sectionId}[]` to a nested `SectionTreeNode[]` tree (KnowledgeBase commit `aa02e65`). Backend has no backwards-compat shim.
**Scope:** Migrate `KnowledgeBasePage.tsx` `OutlinePanel` from rendering a flat `#sectionId` chip list to a collapsible, recursive tree showing title/path/summary.

## Decisions

| Decision | Choice |
|----------|--------|
| Tree behavior | Collapsible, fully expanded by default |
| Per-node content | Path + title + summary inline |
| Render location | Inline expanded table row (keep current pattern) |
| Summary polling | Poll every 5s while any visible `summary` is `null` |
| Implementation | Approach A — all code in `api.ts` + `KnowledgeBasePage.tsx` |

## Type change (`src/api.ts`)

Replace:

```typescript
export type KbSectionRef = { sectionId: number }
export type KbDocumentOutline = KbSectionRef[]
```

With:

```typescript
export interface SectionTreeNode {
  sectionId: number          // never null
  title: string | null
  level: number | null
  path: string | null
  summary: string | null     // null = LLM enrichment still running
  children: SectionTreeNode[] // always present, [] for leaves
}

export type KbDocumentOutline = SectionTreeNode[]
```

## Component structure (`src/pages/KnowledgeBasePage.tsx`)

### `OutlinePanel` (rewritten)

- Collapse state: `useState<Set<number>>` — set of collapsed `sectionId`, default empty (all expanded)
- Header: `"N sections"` + a top-level heading count
- Empty/loading/error guards remain unchanged from current code
- If tree non-empty, renders `<ul>` → `SectionNodeView` recursive
- Polling: a file-private `hasNullSummary(tree)` helper walks the tree. `outlineQuery` (declared in `KnowledgeBasePage`) gets `refetchInterval: (query) => hasNullSummary(query.state.data) ? 5000 : false`

### `SectionNodeView` (new, file-private recursive component)

Each node renders:

```
[chevron] path title          ← single row
          summary text        ← below title, muted
  <children...>               ← recursive indent
```

**Title row:**
- Chevron: `ChevronDown` (expanded) / `ChevronRight` (collapsed), only when `children.length > 0`. Leaves get a 16px spacer to align titles.
- Path: rendered only when `path !== null`, in `text-[#667085] text-xs` — raw dotted path, no `§` prefix
- Title: `title ?? "(untitled)"` in `text-[#172033] text-sm font-medium`

**Summary line:**
- When `summary !== null`: rendered in `text-[#667085] text-xs line-clamp-2`
- When `summary === null`: rendered as `"Summary pending..."` in italic `text-[#98a2b3] text-xs` (replaced by real text when polling detects enrichment completion)

**Indentation** via recursive `<ul>` with `pl-6` per nesting level. No level-based calculation — depth from DOM tree, robust against `level: null`.

**Cursor:** `pointer` on collapsible parent rows; `default` on leaves.

**Large documents:** Rendering 500+ DOM nodes in the expanded table row will cause jank (no virtualization). The backend doc suggests filing an issue for `?maxDepth=N`. Known limitation; out of scope for this change.

## States

| State | Render |
|-------|--------|
| Loading | `"Loading outline…"` (existing) |
| Error | `<ErrorNotice message={...}>` (existing) |
| Empty tree `[]` | `"No sections created."` + hint text (existing) |
| Non-active/archived doc | `"Outline is available only for active or archived documents."` (existing) |
| 404 (doc not found) | via TanStack Query `isError` path |
| 400 (non-numeric id) | via TanStack Query `isError` path |

## Null handling reference

| Field | When `null` |
|-------|-------------|
| `title` | Show `"(untitled)"` |
| `path` | Don't render path prefix |
| `summary` | Show `"Summary pending..."` placeholder (italic muted) |
| `level` | Irrelevant — indent from tree depth, not level |
| `children` | Never null per contract. `[]` = leaf (no chevron). |

## Verification

1. `npm run lint` + `npm run build` — zero errors
2. Expand an active doc with nested headings — tree renders with correct nesting
3. Expand a leaf-only (flat) doc — no chevrons, all nodes aligned
4. Click chevron — subtree toggles
5. Doc with some `summary: null` — `"Summary pending..."` shown, polling fires
6. Expand a doc with zero sections (empty `[]`) — "No sections created." renders
7. Hit `/kb-api/documents/999999/outline` — 404 doesn't crash the page

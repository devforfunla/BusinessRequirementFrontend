# Knowledge Base Document Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Knowledge Base" page to the BusinessRequirementFrontend where users can upload, list, filter, inspect, mark outdated/archived, and delete reference documents served by the KnowledgeBase backend on port 8080.

**Architecture:** Add a second Vite proxy prefix (`/kb-api` -> `http://localhost:8080/api`) and a second axios client (`kbHttp`, `baseURL: '/kb-api'`) so the new backend is cleanly separated from the existing BusinessRule backend (port 8082, `/api/v1`). Add one new page (`KnowledgeBasePage.tsx`) that follows the existing `DocumentsPage` pattern: upload `Panel` + status-filterable table `Panel` with inline expandable outline rows. Extend `StatusPill` to recognize the KB status strings. No new Zustand state, no new dependencies.

**Tech Stack:** React 19, TypeScript (verbatimModuleSyntax, erasableSyntaxOnly, noUnusedLocals/Parameters), Vite 8, Tailwind v4, React Router 7, TanStack Query 5, Axios, Sonner, lucide-react. No test runner configured (per `CLAUDE.md`); verification is `npm run lint && npm run build` plus manual browser smoke.

**Spec:** `docs/superpowers/specs/2026-07-09-knowledge-base-management-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `vite.config.ts` | Modify | Add `/kb-api` proxy entry routing to `http://localhost:8080/api`. |
| `src/api.ts` | Modify | Add `kbHttp` axios client, KB domain types, `knowledgeBaseApi` object. |
| `src/components/ui.tsx` | Modify | Extend `StatusPill` color mapping for `INGESTING` and `ACTIVE`. |
| `src/App.tsx` | Modify | Add `/knowledge-base` route. |
| `src/components/AppShell.tsx` | Modify | Add "Knowledge Base" nav entry (icon `BookOpen`) after Documents. |
| `src/pages/KnowledgeBasePage.tsx` | Create | New page: upload + list + filter + outline + version lifecycle actions. |

No other files are touched. No tests are written (project has no test runner; do not add one).

---

## Conventions for every task

- **TypeScript strictness:** `verbatimModuleSyntax: true` means use `import type` for type-only imports. `erasableSyntaxOnly: true` means no TS enums or constructor parameter properties. `noUnusedLocals`/`noUnusedParameters` means no unused vars (comment them out with `_` prefix if intentionally unused).
- **Path params:** Use `encodeURIComponent` on all path params, even numeric ones (consistency with rest of `api.ts`).
- **Error handling:** Use `getErrorMessage(error)` from `src/api.ts` for all error toasts.
- **Verification:** `npm run lint && npm run build` must pass before each commit. No test runner.
- **Commits:** Conventional Commits style (`feat:`, `chore:`, `docs:`, etc.). End commit messages with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- **Don't commit unrelated WIP:** `package-lock.json`, `vite.config.ts`, `CLAUDE.md`, and `.claude/` may have pre-existing uncommitted changes from before this work. Only stage files this plan touches.

---

## Task 1: Vite proxy + KB API client + types

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/api.ts`

- [ ] **Step 1: Add `/kb-api` proxy entry to `vite.config.ts`**

Current content of `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
    },
  },
})
```

Replace the `server.proxy` block with:
```ts
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/kb-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kb-api/, '/api'),
      },
    },
  },
```

- [ ] **Step 2: Add KB types, `kbHttp` client, and `knowledgeBaseApi` object to `src/api.ts`**

Insert the following at the end of the file (after the existing `semanticJsonField` helper). Use the existing `fromResponse` and `optionalFromResponse` helpers - do not duplicate them.

```ts
// ---------------------------------------------------------------------------
// Knowledge Base API (separate backend on port 8080, REST root /api/documents)
// ---------------------------------------------------------------------------

const kbHttp = axios.create({
  baseURL: '/kb-api',
  headers: { Accept: 'application/json' },
})

export type KbDocumentStatus = 'ingesting' | 'active' | 'failed' | 'outdated' | 'archived'

export type KbDocument = {
  id: number
  name: string
  docType?: string | null
  status: KbDocumentStatus
  version?: string | null
  pageCount?: number | null
  fileName?: string | null
  fileSize?: number | null
  uploadedAt: string
  indexedAt?: string | null
}

export type KbSectionRef = { sectionId: number }
export type KbDocumentOutline = KbSectionRef[]

export const knowledgeBaseApi = {
  list: (status?: KbDocumentStatus) =>
    fromResponse<KbDocument[]>(kbHttp.get('/documents', { params: { status } })),
  outline: (id: number) =>
    fromResponse<KbDocumentOutline>(kbHttp.get(`/documents/${encodeURIComponent(id)}/outline`)),
  upload: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return fromResponse<KbDocument>(
      kbHttp.post('/documents', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    )
  },
  updateVersionStatus: (id: number, status: 'outdated' | 'archived') =>
    fromResponse<KbDocument>(kbHttp.put(`/documents/${encodeURIComponent(id)}/version`, { status })),
  delete: (id: number) =>
    optionalFromResponse<void>(kbHttp.delete(`/documents/${encodeURIComponent(id)}`)),
}
```

- [ ] **Step 3: Verify lint and build pass**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (this runs `tsc -b && vite build`).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts src/api.ts
git commit -m "$(cat <<'EOF'
feat: add KnowledgeBase API client and /kb-api dev proxy

Adds a second axios client (kbHttp) and knowledgeBaseApi object for the
KnowledgeBase backend on port 8080. Adds a /kb-api Vite proxy entry
that rewrites to /api on the target host. No UI yet.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend `StatusPill` color mapping

**Files:**
- Modify: `src/components/ui.tsx` (the `StatusPill` function, currently around lines 118-129)

- [ ] **Step 1: Extend the color mapping**

Current `StatusPill` function:
```tsx
export function StatusPill({ value }: { value?: string | null }) {
  const normalized = value || 'UNKNOWN'
  const style =
    normalized === 'SUCCEEDED' || normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PASSED'
      ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]'
      : normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'BLOCKED'
        ? 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]'
        : normalized === 'RUNNING' || normalized === 'PROCESSING' || normalized === 'QUEUED' || normalized === 'DRAFT'
          ? 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]'
          : 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]'
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', style)}>{normalized}</span>
}
```

Add `INGESTING` to the blue group (alongside `RUNNING`, `PROCESSING`, `QUEUED`, `DRAFT`) and `ACTIVE` to the green group (alongside `SUCCEEDED`, `COMPLETED`, `APPROVED`, `PASSED`). The gray default already covers `OUTDATED` and `ARCHIVED`.

Replace the function with:
```tsx
export function StatusPill({ value }: { value?: string | null }) {
  const normalized = value || 'UNKNOWN'
  const style =
    normalized === 'SUCCEEDED' || normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PASSED' || normalized === 'ACTIVE'
      ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]'
      : normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'BLOCKED'
        ? 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]'
        : normalized === 'RUNNING' || normalized === 'PROCESSING' || normalized === 'QUEUED' || normalized === 'DRAFT' || normalized === 'INGESTING'
          ? 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]'
          : 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]'
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', style)}>{normalized}</span>
}
```

- [ ] **Step 2: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui.tsx
git commit -m "$(cat <<'EOF'
feat(ui): extend StatusPill to recognize INGESTING and ACTIVE

Adds INGESTING to the blue group and ACTIVE to the green group so the
upcoming KnowledgeBase page can render document statuses correctly.
OUTDATED and ARCHIVED fall through to the existing gray default.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Route, nav entry, and stub page

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`
- Create: `src/pages/KnowledgeBasePage.tsx`

- [ ] **Step 1: Create stub `KnowledgeBasePage.tsx`**

Create `src/pages/KnowledgeBasePage.tsx` with a minimal placeholder so the route and nav entry can be wired up and verified before the full page is built:

```tsx
import { PageTitle, Panel, PanelHeader } from '../components/ui'

export function KnowledgeBasePage() {
  return (
    <div className="space-y-5">
      <PageTitle
        title="Knowledge Base"
        description="Upload reference documents. Ingested docs become searchable via the MCP search tool."
      />
      <Panel>
        <PanelHeader title="Documents" description="0 documents" />
        <div className="p-4 text-sm text-[#667085]">Coming soon.</div>
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Add the route in `src/App.tsx`**

Add the import alongside the other page imports (alphabetical order matches existing style):
```tsx
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
```

Add the route inside `<Route element={<AppShell />}>`, after the `/documents` route:
```tsx
<Route path="/knowledge-base" element={<KnowledgeBasePage />} />
```

So the relevant block becomes:
```tsx
<Route path="/" element={<Navigate to="/documents" replace />} />
<Route path="/documents" element={<DocumentsPage />} />
<Route path="/knowledge-base" element={<KnowledgeBasePage />} />
<Route path="/workflows" element={<WorkflowsPage />} />
```

- [ ] **Step 3: Add the nav entry in `src/components/AppShell.tsx`**

Update the lucide-react import to include `BookOpen`:
```tsx
import { Activity, BookOpen, ChevronLeft, ChevronRight, FileText, GitBranch, Layers3, ScrollText, Settings, ShieldCheck } from 'lucide-react'
```

Add the new entry to `navItems` right after Documents:
```tsx
const navItems = [
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { to: '/workflows', label: 'Workflows', icon: GitBranch },
  { to: '/skills', label: 'Skills', icon: Settings },
  { to: '/application-logs', label: 'Application Logs', icon: ScrollText },
  { to: '/trace-logs', label: 'Trace Logs', icon: Activity },
]
```

- [ ] **Step 4: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: success.

- [ ] **Step 5: Manual smoke test - nav and route work**

Run: `npm run dev`
Open: `http://localhost:5173/knowledge-base`
Expected: the page renders with the "Knowledge Base" title and "Coming soon." placeholder. The nav entry "Knowledge Base" (with the `BookOpen` icon) appears second in the left sidebar, after Documents, and highlights when active.

Click the other nav items (Documents, Workflows, Skills) to confirm they still load.

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/AppShell.tsx src/pages/KnowledgeBasePage.tsx
git commit -m "$(cat <<'EOF'
feat: add /knowledge-base route, nav entry, and stub page

Wires up the route and sidebar entry (icon BookOpen, placed after
Documents). The page itself is a placeholder; functionality lands in
subsequent commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Upload panel + documents table + status filter

**Files:**
- Modify: `src/pages/KnowledgeBasePage.tsx`

This task replaces the stub with the upload panel, the documents table, and the status filter. Outline expansion and version lifecycle actions come in Task 5.

- [ ] **Step 1: Replace `KnowledgeBasePage.tsx` with the upload + list + filter implementation**

Replace the entire contents of `src/pages/KnowledgeBasePage.tsx` with:

```tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ListTree, RefreshCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, knowledgeBaseApi, type KbDocument, type KbDocumentStatus } from '../api'
import { formatBytes, formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, Label, PageTitle, Panel, PanelHeader, Select, StatusPill, TextInput } from '../components/ui'

type StatusFilter = KbDocumentStatus | 'all'

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ingesting', label: 'Ingesting' },
  { value: 'active', label: 'Active' },
  { value: 'failed', label: 'Failed' },
  { value: 'outdated', label: 'Outdated' },
  { value: 'archived', label: 'Archived' },
]

export function KnowledgeBasePage() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const documentsQuery = useQuery({
    queryKey: ['kb-documents', statusFilter],
    queryFn: () => knowledgeBaseApi.list(statusFilter === 'all' ? undefined : statusFilter),
    refetchInterval: (query) => {
      const docs = (query.state.data as KbDocument[] | undefined) || []
      return docs.some((d) => d.status === 'ingesting') ? 5000 : 30000
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (f: File) => knowledgeBaseApi.upload(f),
    onSuccess: () => {
      toast.success('Document uploaded')
      setFile(null)
      void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => knowledgeBaseApi.delete(id),
    onSuccess: () => {
      toast.success('Document deleted')
      void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const documents = documentsQuery.data || []

  return (
    <div className="space-y-5">
      <PageTitle
        title="Knowledge Base"
        description="Upload reference documents. Ingested docs become searchable via the MCP search tool."
        actions={
          <Button onClick={() => void documentsQuery.refetch()} disabled={documentsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Panel>
        <PanelHeader title="Upload Reference Document" description="Accepted formats: PDF, TXT, Markdown, DOCX. Max 50MB." />
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <Label label="File">
            <TextInput
              type="file"
              accept=".pdf,.txt,.md,.docx"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </Label>
          <Button
            variant="primary"
            onClick={() => file && uploadMutation.mutate(file)}
            disabled={!file || uploadMutation.isPending}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Documents"
          description={`${documents.length} document${documents.length === 1 ? '' : 's'}`}
          actions={
            <div className="flex items-end">
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-40"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {documentsQuery.isError ? (
          <div className="p-4">
            <ErrorNotice message={getErrorMessage(documentsQuery.error)} />
          </div>
        ) : documents.length === 0 && !documentsQuery.isLoading ? (
          <div className="p-4">
            <EmptyState
              title={statusFilter === 'all' ? 'No documents yet' : 'No documents match this filter'}
              description={
                statusFilter === 'all'
                  ? 'Upload a reference document to make it searchable via the MCP search tool.'
                  : 'Try a different status filter.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Document</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Size</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Pages</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Uploaded</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-b border-[#edf1f6] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-4 w-4 shrink-0 text-[#667085]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#172033]">{document.name}</p>
                          {document.fileName && document.fileName !== document.name ? (
                            <p className="truncate text-xs text-[#667085]">{document.fileName}</p>
                          ) : null}
                          <p className="truncate text-xs text-[#98a2b3]">id: {document.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        title={document.status === 'failed' ? 'Ingestion failed - see backend logs for detail.' : undefined}
                      >
                        <StatusPill value={document.status.toUpperCase()} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#475467]">{formatBytes(document.fileSize)}</td>
                    <td className="px-4 py-3 text-[#475467]">{document.pageCount ?? '-'}</td>
                    <td className="px-4 py-3 text-[#475467]">{formatDate(document.uploadedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="View outline"
                          disabled={document.status !== 'active' && document.status !== 'archived'}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ListTree className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="danger"
                          title="Delete document"
                          onClick={(event) => {
                            event.stopPropagation()
                            if (window.confirm(`Delete "${document.name}"?`)) {
                              deleteMutation.mutate(document.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
```

**Notes on the implementation:**
- `StatusPill` is called with `document.status.toUpperCase()` so the existing uppercase color mapping in `ui.tsx` matches.
- `StatusPill` doesn't accept a `title` prop, so the tooltip is provided by wrapping the pill in a `<span title={...}>`. This surfaces the BE gap (failed status has no persisted reason) via a native HTML tooltip.
- The "View outline" button is present but currently does nothing useful (its `onClick` only stops propagation). Task 5 wires up the outline panel and updates this `onClick`.
- All action buttons call `event.stopPropagation()` even though the row doesn't yet have an onClick handler - this is forward-compatible so Task 5 can add row-click toggle without breaking the buttons.
- The status filter `Select` is wrapped in a `<div className="flex items-end">` (not `<Label label="">`) for clean alignment in the panel header without an empty label.

- [ ] **Step 2: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: success.

Watch for: `noUnusedLocals`/`noUnusedParameters` errors. If any unused imports are flagged (e.g., `ListTree` if accidentally not used), remove them.

- [ ] **Step 3: Manual smoke test - upload, list, filter, delete**

Prerequisites: KnowledgeBase backend running on `http://localhost:8080` (per the BE `application.yml`, default port is 8080).

Run: `npm run dev`
Open: `http://localhost:5173/knowledge-base`

Test cases:
1. **Empty state:** With no documents, the page shows "No documents yet. Upload a reference document to make it searchable via the MCP search tool."
2. **Upload:** Click the file input, pick a small PDF, click Upload. Toast "Document uploaded" appears. The document appears in the table with status `INGESTING` (blue).
3. **Polling:** Wait ~5-30 seconds. The status transitions to `ACTIVE` (green) once the BE finishes ingestion. (If it goes `FAILED` (red), check the BE logs - likely Docling isn't running.)
4. **Filter:** Change the status filter to `Active`. Verify only active docs show. Change to `Ingesting`. Verify only ingesting docs show. Change back to `All`.
5. **Delete:** Click the trash icon on a row. Confirm in the dialog. Toast "Document deleted" appears. The row disappears.
6. **Filter empty state:** Set filter to `Archived` when no archived docs exist. Verify the "No documents match this filter" empty state shows.
7. **Multi-format:** Upload a `.md` and a `.txt` and a `.docx` file. Verify all three flow through ingestion to `ACTIVE`.
8. **Error path:** Try uploading a file larger than 50MB. Verify an error toast appears with the BE's error message.

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/pages/KnowledgeBasePage.tsx
git commit -m "$(cat <<'EOF'
feat: implement KB page upload, list, status filter, and delete

Replaces the stub with the upload panel, documents table, status filter
dropdown, and delete action. Adaptive polling: 5s while any visible doc
is ingesting, 30s otherwise. The View outline button is present but
inert; the outline panel lands in the next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Inline outline panel + version lifecycle actions

**Files:**
- Modify: `src/pages/KnowledgeBasePage.tsx`

This task adds:
- An expandable inline outline panel per row (toggled by row click or the "View outline" button).
- "Mark outdated" and "Mark archived" action buttons with `window.confirm` dialogs.

- [ ] **Step 1: Add the outline query, `expandedDocId` state, and `Fragment` import**

Update the React import at the top of `src/pages/KnowledgeBasePage.tsx` to include `Fragment`:

```tsx
import { Fragment, useState } from 'react'
```

Update the TanStack Query import to include `type UseQueryResult`:

```tsx
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
```

Update the api import to include `type KbDocumentOutline`:

```tsx
import { getErrorMessage, knowledgeBaseApi, type KbDocument, type KbDocumentOutline, type KbDocumentStatus } from '../api'
```

Add `expandedDocId` state next to the existing `file` / `statusFilter` state:

```tsx
const [expandedDocId, setExpandedDocId] = useState<number | null>(null)
```

Add the outline query below the existing `documentsQuery`:

```tsx
const outlineQuery = useQuery({
  queryKey: ['kb-document-outline', expandedDocId],
  queryFn: () => knowledgeBaseApi.outline(expandedDocId!),
  enabled: expandedDocId !== null,
  staleTime: 60_000,
})
```

- [ ] **Step 2: Add the `updateVersionMutation`**

Add below the existing `deleteMutation`:

```tsx
const updateVersionMutation = useMutation({
  mutationFn: (vars: { id: number; status: 'outdated' | 'archived' }) =>
    knowledgeBaseApi.updateVersionStatus(vars.id, vars.status),
  onSuccess: (_data, vars) => {
    toast.success(`Marked ${vars.status}`)
    void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
  },
  onError: (error) => toast.error(getErrorMessage(error)),
})
```

- [ ] **Step 3: Update the icon imports**

Update the lucide-react import to include `Archive` and `Box`:

```tsx
import { Archive, Box, BookOpen, ListTree, RefreshCw, Trash2, Upload } from 'lucide-react'
```

- [ ] **Step 4: Render the outline row when expanded and make the row clickable**

The `.map()` callback must return a single element (JSX requires one parent). Since the row already has a `key`, wrap both `<tr>` elements in a `<Fragment key={document.id}>` (the `<>...</>` shorthand can't take a `key`).

Replace the existing `<tr>` opening tag and its closing `</tr>` plus the `))}` terminator:

```tsx
                {documents.map((document) => (
                  <tr key={document.id} className="border-b border-[#edf1f6] last:border-0">
                    {/* ...existing cells... */}
                  </tr>
                ))}
```

With:

```tsx
                {documents.map((document) => (
                  <Fragment key={document.id}>
                    <tr
                      className="cursor-pointer border-b border-[#edf1f6] last:border-0 hover:bg-[#f8fafc]"
                      onClick={() => setExpandedDocId((current) => (current === document.id ? null : document.id))}
                    >
                      {/* ...existing cells (unchanged, including the Actions cell from Step 7 below)... */}
                    </tr>
                    {expandedDocId === document.id ? (
                      <tr>
                        <td colSpan={6} className="border-b border-[#edf1f6] bg-[#f8fafc] px-4 py-3">
                          <OutlinePanel doc={document} outlineQuery={outlineQuery} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
```

The `<tr key={document.id}>` becomes `<Fragment key={document.id}>` and the inner `<tr>` drops its `key` (the Fragment now carries it). The `onClick` on the inner `<tr>` toggles `expandedDocId`. The outline `<tr>` doesn't need its own key because it's a conditional single child of the Fragment.

- [ ] **Step 5: Add the `OutlinePanel` helper component at the bottom of the file**

Append after the `KnowledgeBasePage` function. Uses `UseQueryResult<KbDocumentOutline>` (imported in Step 1) for the query prop type:

```tsx
function OutlinePanel({
  doc,
  outlineQuery,
}: {
  doc: KbDocument
  outlineQuery: UseQueryResult<KbDocumentOutline>
}) {
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
  const sections = outlineQuery.data || []
  if (sections.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[#172033]">No sections created.</p>
        <p className="text-xs text-[#667085]">
          Ingestion produced zero sections. The source document may have been empty or unparseable.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#172033]">
        {sections.length} section{sections.length === 1 ? '' : 's'} created.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((section) => (
          <span
            key={section.sectionId}
            className="rounded border border-[#d8dee8] bg-white px-2 py-0.5 text-xs text-[#475467]"
          >
            #{section.sectionId}
          </span>
        ))}
      </div>
      <p className="text-xs text-[#98a2b3]">
        Outline endpoint returns section IDs only. Content view is future work.
      </p>
    </div>
  )
}
```

The `KbDocumentOutline` and `UseQueryResult` types are already imported from Step 1 - no additional imports needed.

- [ ] **Step 6: Wire up the "View outline" button to toggle `expandedDocId`**

Update the "View outline" button's `onClick`:

```tsx
<Button
  size="icon"
  variant="ghost"
  title="View outline"
  disabled={document.status !== 'active' && document.status !== 'archived'}
  onClick={(event) => {
    event.stopPropagation()
    setExpandedDocId((current) => (current === document.id ? null : document.id))
  }}
>
  <ListTree className="h-4 w-4" aria-hidden="true" />
</Button>
```

- [ ] **Step 7: Add "Mark outdated" and "Mark archived" buttons**

Between the "View outline" button and the "Delete" button in the Actions cell, add two new buttons:

```tsx
<Button
  size="icon"
  variant="ghost"
  title="Mark outdated (removes from search index)"
  disabled={document.status !== 'active'}
  onClick={(event) => {
    event.stopPropagation()
    if (window.confirm(`Mark "${document.name}" as outdated? This removes it from the MCP search index.`)) {
      updateVersionMutation.mutate({ id: document.id, status: 'outdated' })
    }
  }}
>
  <Archive className="h-4 w-4" aria-hidden="true" />
</Button>
<Button
  size="icon"
  variant="ghost"
  title="Mark archived (removes from search index)"
  disabled={document.status !== 'active' && document.status !== 'outdated'}
  onClick={(event) => {
    event.stopPropagation()
    if (window.confirm(`Mark "${document.name}" as archived? This removes it from the MCP search index.`)) {
      updateVersionMutation.mutate({ id: document.id, status: 'archived' })
    }
  }}
>
  <Box className="h-4 w-4" aria-hidden="true" />
</Button>
```

- [ ] **Step 8: Verify lint and build pass**

Run: `npm run lint && npm run build`
Expected: success.

Watch for: unused imports (`Archive`, `Box`, `KbDocumentOutline`, `UseQueryResult`), unused parameters, `verbatimModuleSyntax` errors (use `import type` for type-only imports).

- [ ] **Step 9: Manual smoke test - outline, mark outdated, mark archived**

Prerequisites: KnowledgeBase backend on `http://localhost:8080` with at least one `active` document.

Run: `npm run dev`
Open: `http://localhost:5173/knowledge-base`

Test cases:
1. **Outline expand (button):** Click the `ListTree` icon on an active doc. A panel expands below the row showing "N sections created." and a list of `#<sectionId>` chips.
2. **Outline expand (row click):** Click anywhere else on the row. The outline panel toggles.
3. **Outline collapse:** Click the row again (or the ListTree icon). The panel collapses.
4. **Outline empty state:** If a doc has zero sections, the panel shows "No sections created." with the explanation.
5. **Outline for non-active:** The ListTree button is disabled (cursor-not-allowed) for `ingesting`/`failed` docs.
6. **Outline for archived:** The ListTree button is enabled for `archived` docs; clicking shows their outline.
7. **Mark outdated:** Click the `Archive` icon on an active doc. Confirm in the dialog. Toast "Marked outdated" appears. The status pill updates to `OUTDATED` (gray) after the next poll. The `Archive` icon becomes disabled; the `Box` icon stays enabled.
8. **Mark archived:** Click the `Box` icon on an active or outdated doc. Confirm. Toast "Marked archived" appears. Status pill updates to `ARCHIVED` (gray). Both `Archive` and `Box` icons become disabled.
9. **Action buttons don't toggle outline:** Click any action button (View outline, Mark outdated, Mark archived, Delete). The outline panel should NOT toggle when an action button is clicked (only when the row itself is clicked).
10. **Adaptive polling still works:** Upload a new doc; verify polling transitions `INGESTING` -> `ACTIVE`.

Stop the dev server when done.

- [ ] **Step 10: Commit**

```bash
git add src/pages/KnowledgeBasePage.tsx
git commit -m "$(cat <<'EOF'
feat: add KB outline panel and version lifecycle actions

Adds an inline expandable outline panel (toggled by row click or the
View-outline button) showing section count and IDs. Adds Mark-outdated
and Mark-archived action buttons with confirmation dialogs; both call
PUT /documents/{id}/version and remove the doc from the search index.
All action buttons stopPropagation so they don't toggle the outline.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After all five tasks land:

- [ ] **Step 1: Full lint and build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 2: Full manual smoke test**

Re-run all smoke tests from Tasks 3, 4, and 5 in sequence. Confirm:
- Page loads at `/knowledge-base`.
- Nav entry "Knowledge Base" appears second in the sidebar, highlights when active.
- Other pages (Documents, Workflows, Skills, Application Logs, Trace Logs) still load and function.
- Upload + ingest + filter + outline + mark outdated/archived + delete all work end-to-end.

- [ ] **Step 3: Optional - update `CLAUDE.md`**

`CLAUDE.md` currently says the Vite proxy targets `http://localhost:8080`. The actual config (before this work) targets `http://localhost:8082`, and this plan adds a second proxy entry for `http://localhost:8080` (the KnowledgeBase backend). Update the "Vite dev proxy" section of `CLAUDE.md` to reflect both proxy entries and clarify which backend is which. This is a docs-only change and can be a separate commit.

---

## Notes for the implementer

- **No test runner.** Don't add Jest/Vitest/etc. Verification is `npm run lint && npm run build` plus the manual smoke steps described per task. If a smoke step fails, debug it before moving on - don't skip.
- **Don't commit unrelated WIP.** `package-lock.json`, `vite.config.ts` (pre-existing changes), `CLAUDE.md`, and `.claude/` may show up as modified/untracked. Only stage files this plan explicitly touches.
- **Stop the dev server between tasks** unless the next task continues UI work. The dev server holds port 5173; running `npm run build` while it's running is fine, but starting a second dev server will fail.
- **If `npm run build` fails with TS errors**, read the errors carefully. The project has `verbatimModuleSyntax: true` (use `import type` for types), `erasableSyntaxOnly: true` (no enums or constructor parameter properties), and `noUnusedLocals`/`noUnusedParameters` (no unused vars). These are the most common failure modes.
- **If the BE isn't running**, smoke tests that hit `/kb-api/*` will fail with network errors. The page should still render (queries fail gracefully into `ErrorNotice`). Don't proceed past a smoke test if the BE is down - start it first.

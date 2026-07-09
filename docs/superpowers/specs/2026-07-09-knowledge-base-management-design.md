# Knowledge Base Document Management - Design

**Date:** 2026-07-09
**Status:** Draft for review
**Project:** `BusinessRequirementFrontend`

## 1. Purpose

Add a new page to the BusinessRequirementFrontend where users can manage reference documents served by the separate KnowledgeBase backend (currently running on `http://localhost:8080`). The KnowledgeBase backend ingests uploaded documents (parsing via Docling, chunking, indexing into Lucene) and exposes them as searchable content through an MCP tool the AI can call.

Users need to upload documents, watch ingestion progress, see the resulting status, view the section outline produced by ingestion, mark documents as outdated or archived (which removes them from the search index), and delete documents.

## 2. Background & context

### 2.1 Existing frontend

- React 19 + TypeScript + Vite 8 + Tailwind v4 + React Router 7 + TanStack Query 5 + Zustand 5 + Axios + Sonner.
- Existing axios client `http` in `src/api.ts` has `baseURL: '/api/v1'` and is used for the BusinessRule backend (the "two-phase rule pipeline" service).
- Vite dev proxy (`vite.config.ts`) currently routes `/api` -> `http://localhost:8082` (the BusinessRule backend). Note: `CLAUDE.md` states port 8080, but the actual config is 8082 - `CLAUDE.md` is stale on this point.
- `src/components/AppShell.tsx` defines the left nav. Current entries: Documents, Workflows, Skills, Application Logs, Trace Logs.
- `src/pages/DocumentsPage.tsx` is the closest pattern reference: it uploads a file, lists documents in a table, shows a status pill, supports delete via `window.confirm`, and polls the list every 5 seconds.
- Design system lives in `src/components/ui.tsx` with hardcoded hex colors and components: `Button`, `Panel`, `PanelHeader`, `PageTitle`, `TextInput`, `Select`, `Label`, `StatusPill`, `EmptyState`, `ErrorNotice`, `JsonBlock`, `JsonDrawer`, etc. `StatusPill` color-maps known statuses (SUCCEEDED, FAILED, RUNNING, etc.).
- No test runner is configured. Verification is `npm run lint && npm run build`.

### 2.2 KnowledgeBase backend

A separate Spring Boot service (source at `C:\Work\Workspace\hkex\KnowledgeBase`) running on port 8080. REST root is `/api/documents` (no `/v1` prefix). API docs at `/v3/api-docs`. Multipart limit 50MB.

`Document` entity fields: `id (Long)`, `name`, `docType`, `status`, `version`, `pageCount`, `fileName`, `fileSize`, `uploadedAt`, `indexedAt`.

Status flow:
- `ingesting` - initial state after upload; async ingestion is running.
- `active` - ingestion succeeded; document is in the Lucene index and MCP search tool returns it.
- `failed` - ingestion threw an exception. The BE saves status but does **not** persist the error reason.
- `outdated` - set via `PUT /{id}/version` with `{"status":"outdated"}`. BE also removes the doc from the Lucene index.
- `archived` - same mechanism as `outdated`; also removes from index.

REST endpoints:
- `POST /api/documents` (multipart `file` required; optional `name`, `doc_type`, `version`) -> 202 with `DocumentResponse`. Triggers async ingestion.
- `GET /api/documents?status=` -> list.
- `GET /api/documents/{id}` -> single doc.
- `GET /api/documents/{id}/status` -> `{status, indexedAt}`.
- `GET /api/documents/{id}/outline` -> `[{sectionId}]`. Returns section IDs only - no content or headings.
- `PUT /api/documents/{id}/version` with `{status}` -> updated `DocumentResponse`. Used for `outdated`/`archived`.
- `DELETE /api/documents/{id}` -> 204.

Ingestion is fully async on the BE side (`@Async("ingestionExecutor")`). The upload response returns immediately with status `ingesting`. There is no jobId; clients must poll to observe the status transition.

MCP tool registration (`/mcp/message` endpoint) is automatic for `active` docs - there is no BE API to manage or list MCP tools. Out of scope for this page.

## 3. Requirements

### 3.1 Functional

1. Users can upload a reference document (`.pdf`, `.txt`, `.md`, `.docx`) from the page.
2. Users can see the list of all uploaded documents with their current status.
3. Users can filter the list by status.
4. Users can delete a document.
5. Users can mark an active document as `outdated` or `archived` (removes from search index).
6. Users can view the section outline for an active or archived document.
7. The page polls the BE so ingestion progress (`ingesting` -> `active` / `failed`) is reflected without manual refresh.

### 3.2 Non-functional

- Follow existing code patterns: TanStack Query for server state, sonner for toasts, `getErrorMessage` for error formatting, `window.confirm` for destructive actions.
- No new dependencies.
- No test runner added.
- Verification = `npm run lint && npm run build`.
- Must not break any existing page or route.

### 3.3 Out of scope

- Editing `name`, `doc_type`, or `version` after upload (BE has no PATCH endpoint for these).
- Uploading a new version of an existing document (BE has no endpoint; `previousVersionId` field exists but is never populated by any API).
- Viewing section content (BE outline endpoint returns IDs only).
- Viewing failure reason for `failed` documents (BE does not persist it).
- Managing MCP tool registrations (no BE API).
- Searching the knowledge base from this page (search is via the MCP tool, used by AI agents, not this UI).

## 4. Design

### 4.1 Routing & proxy strategy

**Problem:** The existing axios client has `baseURL: '/api/v1'` and the Vite proxy sends `/api` to port 8082 (BusinessRule backend). The KnowledgeBase backend is on port 8080 with REST root `/api/documents` (no `/v1`). The two API surfaces don't share a prefix.

**Decision:** Add a second Vite proxy prefix and a second axios client. Each backend service is addressable by its own prefix; no path-prefix disambiguation in the proxy.

`vite.config.ts`:
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8082', changeOrigin: true },
    '/kb-api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/kb-api/, '/api'),
    },
  },
},
```

So a frontend call to `/kb-api/documents` is proxied to `http://localhost:8080/api/documents`.

### 4.2 API client & types

Add to `src/api.ts`:

```ts
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

export type KbDocumentStatusResponse = {
  status: KbDocumentStatus
  indexedAt?: string | null
}

export type KbSectionRef = { sectionId: number }
export type KbDocumentOutline = KbSectionRef[]

export const knowledgeBaseApi = {
  list: (status?: KbDocumentStatus) =>
    fromResponse<KbDocument[]>(kbHttp.get('/documents', { params: { status } })),
  get: (id: number) =>
    fromResponse<KbDocument>(kbHttp.get(`/documents/${encodeURIComponent(id)}`)),
  status: (id: number) =>
    fromResponse<KbDocumentStatusResponse>(kbHttp.get(`/documents/${encodeURIComponent(id)}/status`)),
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

The existing `fromResponse` and `optionalFromResponse` helpers are reused. `encodeURIComponent` is used on path params even though they're numeric, for consistency with the rest of the file.

### 4.3 Routing

`src/App.tsx` - add a new route inside the existing `<Route element={<AppShell />}>` block:

```tsx
<Route path="/knowledge-base" element={<KnowledgeBasePage />} />
```

### 4.4 Navigation

`src/components/AppShell.tsx` - add a new entry to `navItems`, placed immediately after Documents:

```ts
import { BookOpen, ... } from 'lucide-react'

const navItems = [
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { to: '/workflows', label: 'Workflows', icon: GitBranch },
  { to: '/skills', label: 'Skills', icon: Settings },
  { to: '/application-logs', label: 'Application Logs', icon: ScrollText },
  { to: '/trace-logs', label: 'Trace Logs', icon: Activity },
]
```

`BookOpen` is chosen to distinguish the entry from the existing `FileText` (Documents) icon.

### 4.5 State

No new Zustand state. The page is self-contained:
- `statusFilter` (`KbDocumentStatus | 'all'`) lives in component state.
- `expandedDocId` (`number | null`) for the outline panel lives in component state.
- The existing `selectedDocumentId` in the Zustand store is for the rule pipeline (DocumentsPage -> workflows) and is unrelated to this page.

### 4.6 Page component

New file: `src/pages/KnowledgeBasePage.tsx`.

Layout (top to bottom):
1. `PageTitle` - title "Knowledge Base", description "Upload reference documents. Ingested docs become searchable via the MCP search tool.", action: Refresh button.
2. `Panel` (upload) - `PanelHeader` "Upload Reference Document" + a row with a file input (`accept=".pdf,.txt,.md,.docx"`) and an Upload `Button` (variant primary). Upload button disabled while no file is chosen or while `uploadMutation.isPending`.
3. `Panel` (documents) - `PanelHeader` "Documents" with a count and a `Select` status filter on the right. Body is either `ErrorNotice`, `EmptyState`, or a table.

Table columns:
| Column | Source field | Notes |
|---|---|---|
| Document | `name`, `fileName`, `id` | Icon + name; subtitle shows `fileName` if different from `name`; tertiary shows `id`. |
| Status | `status` | `StatusPill` with extended color mapping (see 4.7). |
| Size | `fileSize` | `formatBytes` helper (already in `src/utils.ts`). |
| Pages | `pageCount` | `-` if null. |
| Version | `version` | `-` if null. |
| Uploaded | `uploadedAt` | `formatDate` helper. |
| Actions | - | See 4.8. |

Clicking anywhere on a row toggles the inline outline panel for that row (in addition to the explicit "View outline" button in Actions). The outline panel renders below the row, spanning all columns.

Outline panel content:
- If `status` is `active` or `archived`: shows "{N} sections created" and a horizontally-scrollable list of section IDs from `outlineQuery.data`.
- If `outlineQuery.isPending`: shows "Loading outline…".
- If `outlineQuery.isError`: shows `ErrorNotice` with the message.
- If outline is empty array: shows "No sections were created during ingestion."
- A small muted note: "Outline endpoint returns section IDs only. Content view is future work."

### 4.7 StatusPill extension

`src/components/ui.tsx` - extend the `StatusPill` color mapping to recognize the KB statuses. The existing mapping matches uppercase strings; KB statuses are lowercase. Two options were considered:

- **Option A:** Normalize KB statuses to uppercase before passing to `StatusPill` (e.g., `StatusPill value={doc.status.toUpperCase()}`), then add `INGESTING` and `ACTIVE` to the existing mapping. `OUTDATED` and `ARCHIVED` fall through to the default gray style.
- **Option B:** Add lowercase variants directly to the mapping.

**Decision:** Option A. Keeps the mapping uppercase-only, consistent with the existing convention. Add `INGESTING` to the blue group (alongside `RUNNING`, `PROCESSING`, `QUEUED`) and `ACTIVE` to the green group (alongside `SUCCEEDED`, `APPROVED`). `OUTDATED` and `ARCHIVED` use the default gray style, which is appropriate for "no longer active" semantics.

The page normalizes the value before passing to `StatusPill`:
```tsx
<StatusPill value={doc.status.toUpperCase()} />
```

### 4.8 Row actions

Rendered as small buttons in the Actions column, following `DocumentsPage` styling conventions:

| Action | Icon | Variant | Enablement | Confirmation |
|---|---|---|---|---|
| View outline | `ListTree` | ghost, size sm | Disabled when status is `ingesting` or `failed` (no sections exist). Toggles `expandedDocId`. | None. |
| Mark outdated | `Archive` (or `ClockHistory`) | ghost, size sm | Disabled unless status is `active`. | `window.confirm`: `Mark "${name}" as outdated? This removes it from the MCP search index.` |
| Mark archived | `Box` | ghost, size sm | Disabled unless status is `active` or `outdated`. | `window.confirm`: `Mark "${name}" as archived? This removes it from the MCP search index.` |
| Delete | `Trash2` | danger, size icon | Always enabled. | `window.confirm`: `Delete "${name}"?` |

### 4.9 Data flow

**List query:**
```ts
const [statusFilter, setStatusFilter] = useState<KbDocumentStatus | 'all'>('all')

const documentsQuery = useQuery({
  queryKey: ['kb-documents', statusFilter],
  queryFn: () =>
    knowledgeBaseApi.list(statusFilter === 'all' ? undefined : statusFilter),
  refetchInterval: (query) => {
    const docs = query.state.data || []
    return docs.some((d) => d.status === 'ingesting') ? 5000 : 30000
  },
})
```

Adaptive polling: 5s while any visible doc is `ingesting`, 30s otherwise. Keeps UI responsive during ingestion without hammering the BE at idle.

**Outline query** (fetched on expand):
```ts
const [expandedDocId, setExpandedDocId] = useState<number | null>(null)

const outlineQuery = useQuery({
  queryKey: ['kb-document-outline', expandedDocId],
  queryFn: () => knowledgeBaseApi.outline(expandedDocId!),
  enabled: expandedDocId !== null,
  staleTime: 60_000,
})
```

`staleTime: 60_000` because the outline doesn't change after ingestion completes.

**Mutations:**

```ts
const uploadMutation = useMutation({
  mutationFn: (file: File) => knowledgeBaseApi.upload(file),
  onSuccess: () => {
    toast.success('Document uploaded')
    setFile(null)
    void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
  },
  onError: (e) => toast.error(getErrorMessage(e)),
})

const deleteMutation = useMutation({
  mutationFn: (id: number) => knowledgeBaseApi.delete(id),
  onSuccess: () => {
    toast.success('Document deleted')
    void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
  },
  onError: (e) => toast.error(getErrorMessage(e)),
})

const updateVersionMutation = useMutation({
  mutationFn: (vars: { id: number; status: 'outdated' | 'archived' }) =>
    knowledgeBaseApi.updateVersionStatus(vars.id, vars.status),
  onSuccess: (_data, vars) => {
    toast.success(`Marked ${vars.status}`)
    void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
  },
  onError: (e) => toast.error(getErrorMessage(e)),
})
```

No optimistic updates. The BE completes these synchronously and the invalidate refetches immediately. This matches the `DocumentsPage` precedent for delete/transform.

Query key convention: `['kb-documents', statusFilter]` and `['kb-document-outline', docId]`, following the existing `['entity-type', ...]` convention.

### 4.10 Error handling

- All API errors flow through `getErrorMessage(error)` (handles axios body `{message}`/`{error}`, raw string bodies, and generic Errors).
- Query errors render via `ErrorNotice` above the table, matching `DocumentsPage`.
- Mutation errors surface via `toast.error(getErrorMessage(...))`.
- Upload with no file: button disabled, cannot trigger.
- Upload of an over-50MB file: BE returns 413 or 500; axios error message surfaces via toast. No client-side size pre-check (BE limit is the source of truth).
- Failed ingestion: row shows red "Failed" pill. The pill's `title` attribute (HTML tooltip) says "Ingestion failed - see backend logs for detail." This is the BE gap noted as future work.

### 4.11 Edge cases

- **Status transition during session:** A doc that was `active` when the user clicked "Mark outdated" might already be `outdated` by the time the request lands. The BE no-ops and returns current state; the invalidate refetches and the UI reflects truth. No special handling.
- **Delete an `ingesting` doc:** BE allows it. The async ingestion task will fail or no-op when it tries to mark the deleted doc. UI permits it - no extra guard. The next poll shows the doc gone.
- **Upload while a previous upload is in flight:** Upload button disabled while `uploadMutation.isPending`. No queueing (single-flight).
- **Outline query for a doc that transitions to `failed` before the response:** The "View outline" button is disabled for non-`active`/non-`archived` docs, so the query won't fire from a fresh click. If the user expanded a doc and it then transitions to `failed`, the outline query may return an empty array or 404 - render the empty/error state gracefully inside the panel.
- **`indexedAt` null:** For `ingesting`/`failed` docs, the "Indexed" column (if shown - actually folded into "Uploaded" area in this design; see table columns) shows `-`.
- **Filtering hides an expanded doc:** If the user has doc A's outline expanded, then changes the filter so doc A is no longer in the list, the row disappears and `expandedDocId` becomes stale. The outline query is `enabled: expandedDocId !== null` and will keep returning data, but no panel renders because the row is gone. This is harmless; when the user changes the filter back, the panel reappears with cached data. No explicit cleanup needed.

### 4.12 File map

| File | Change |
|---|---|
| `vite.config.ts` | Add `/kb-api` proxy entry. |
| `src/api.ts` | Add `kbHttp` client, KB types, `knowledgeBaseApi` object. |
| `src/App.tsx` | Add `/knowledge-base` route. |
| `src/components/AppShell.tsx` | Add "Knowledge Base" nav entry (icon: `BookOpen`) after Documents. |
| `src/components/ui.tsx` | Extend `StatusPill` color mapping: add `INGESTING` (blue), `ACTIVE` (green). |
| `src/pages/KnowledgeBasePage.tsx` | New page component. |

No other files are touched. No new dependencies.

### 4.13 Verification

- `npm run lint` must pass.
- `npm run build` (which includes `tsc -b`) must pass.
- Manual smoke test against a running KnowledgeBase backend on `localhost:8080`:
  1. Upload a small PDF. Watch the row appear with `Ingesting` status, then transition to `Active` via polling.
  2. Click "View outline" on the active row. Verify section count and IDs render.
  3. Filter by status = Active. Verify the list narrows.
  4. Click "Mark outdated" on an active doc. Confirm in the dialog. Verify the status pill updates to `Outdated` after refetch.
  5. Click "Delete" on a doc. Confirm. Verify the row disappears.
  6. Upload a `.docx` and a `.md` file - verify both flow through ingestion.
  7. Upload a file >50MB. Verify the error toast surfaces the BE error.
  8. Navigate to `/knowledge-base` directly - verify the page loads and the nav entry is highlighted.
  9. Verify other pages (Documents, Workflows, etc.) still load and function.

## 5. Future work (BE gaps, not implemented)

These items are noted because they would meaningfully improve the page, but each requires a BE change that is out of scope for this design:

1. **Outline content:** `GET /api/documents/{id}/outline` returns `[{sectionId}]` only. Extending the response to include `sortOrder` and a content snippet (first ~200 chars) would let the UI show a meaningful outline instead of just IDs.
2. **Failure reason:** When ingestion fails, the BE saves `status = "failed"` but discards the exception message. Adding a `lastError` column to the `Document` entity and surfacing it in `DocumentResponse` would let the UI show why ingestion failed.
3. **New version upload:** The `Document` entity has `previousVersionId` but no BE endpoint populates it. A `POST /api/documents/{id}/versions` endpoint (multipart, like upload but linking the previous) would let users replace a doc with a new version while preserving history.
4. **Section content endpoint:** A `GET /api/documents/{id}/sections/{sectionId}` endpoint returning the full section content would let users click an outline entry and read the actual text.
5. **CLAUDE.md update:** `CLAUDE.md` states the Vite proxy targets port 8080; the actual config targets 8082. This is unrelated to the KB page but should be corrected in the same PR or a follow-up.

## 6. Open questions

None at design time. All decisions captured above were resolved through brainstorming with the user.

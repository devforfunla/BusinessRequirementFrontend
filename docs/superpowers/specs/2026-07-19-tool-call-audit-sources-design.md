# Design: Research Sources Citation Display in Trace Logs

**Date:** 2026-07-19
**Status:** Approved
**Parent spec:** `BusinessRequirementService/docs/superpowers/specs/2026-07-19-tool-call-audit-sources-api-change.md`

---

## Summary

The trace endpoint `GET /api/v1/trace/jobs/{jobId}` now returns an optional `sourcesJson` field on each `ToolCallAudit`. When present, it contains a JSON-encoded array of `SourceEntry` objects — the audit trail of which document sections were read during a research tool call. This design adds citation rendering to the trace logs page so users can review these sources.

---

## Backend Contract (from parent spec)

### New field on `ToolCallAudit`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `sourcesJson` | string (JSON) | Yes | JSON-encoded array of `SourceEntry`. Null when tool call failed, agent didn't run, or no sections were read. |

### SourceEntry schema

| Field | Type | Nullable | Description |
|---|---|---|---|
| `docId` | number | No | Document ID |
| `docName` | string | Yes | Human-readable document name (e.g., "Rulebook.pdf") |
| `sectionId` | number | No | Section ID |
| `title` | string | Yes | Section title |
| `level` | number | Yes | Heading level (1-3) |
| `path` | string | Yes | Outline path (e.g., "3.1.1") |
| `referredFromSectionId` | number | Yes | Section the agent navigated from. Null for direct search hits |
| `referredFromDocName` | string | Yes | Doc name of referring section |
| `referredFromPath` | string | Yes | Outline path of referring section |
| `reason` | string | Yes | Free-text reason the agent read this section |

`sourcesJson` is a **JSON-encoded string**, not a nested object. The frontend must `JSON.parse()` it.

---

## Design Decisions

### 1. Citation display: Bibliography footer

Citations render as a numbered list below the tool call response, always visible (not hidden behind a click). This follows Pattern A from the API spec.

### 2. Reason display: Tooltip on hover

The `reason` field is shown as a tooltip via the native HTML `title` attribute on an info icon, keeping the citation list compact while making context discoverable.

### 3. Component placement: Shared `SourcesList` in `ui.tsx`

Following the existing pattern where display primitives (`JsonBlock`, `JsonDetails`, `JsonDrawer`) live in `src/components/ui.tsx`, the new `SourcesList` component is added there as a reusable primitive. The trace page imports and renders it.

---

## Implementation

### 1. Type change — `src/api.ts`

Add one field to the `ToolCallAudit` type (after `responseJson`):

```typescript
export type ToolCallAudit = {
  // ... existing fields unchanged ...
  responseJson?: string | null
  sourcesJson?: string | null   // NEW
  status: string
  // ...
}
```

### 2. New component — `src/components/ui.tsx`

A `SourcesList` component:

```typescript
export function SourcesList({ sourcesJson }: { sourcesJson?: string | null }) {
  // Returns null when: null/undefined, empty string, malformed JSON, empty array
  // Renders: separator line + "Sources (N)" header + numbered list of citations
  // Each citation: [N] docName §path — title (from refDoc §refPath)  ⓘ
}
```

**Parse logic:**
- Guard: if falsy, return `null`
- `try { JSON.parse() } catch { console.warn, return null }`
- Guard: if not array or empty, return `null`

**Format per entry:**
- `[index + 1]` prefix in primary blue
- `docName ?? 'Document ' + docId` for document name
- `'§' + path` when path exists, else `'(section ' + sectionId + ')'`
- `' — ' + title` when title exists, omitted otherwise
- Reference chain: `' (from ' + docName + ' §' + path + ')'` when `referredFromSectionId` is non-null, with fallback to `'(from section ' + id + ')'` when referring doc name/path are null
- `ⓘ` icon with `title={reason}` for native tooltip

**Styling:**
- `border-t border-[#e3e8f0]` separator
- `mt-2 pt-2` spacing
- Small uppercase muted header: "Sources (N)"
- Compact `text-xs` / `text-sm` list
- Blue `[N]` markers using primary `#1f6feb`
- Info icon in muted gray `#98a2b3` with `cursor-help`

### 3. Integration — `src/pages/TraceLogsPage.tsx`

In the tool call rendering loop, add after the existing response `PayloadDetails`:

```tsx
{tc.responseJson ? <PayloadDetails title="Response" value={tc.responseJson} /> : null}
<SourcesList sourcesJson={tc.sourcesJson} />
```

No conditional needed — the component returns `null` when there's nothing to show.

---

## Edge Cases

| Case | Behavior |
|---|---|
| `sourcesJson` is `null`/`undefined` | Component returns `null` |
| `sourcesJson` is empty string `""` | Component returns `null` |
| `sourcesJson` is malformed JSON | `console.warn`, returns `null` |
| Parsed array is empty `[]` | Component returns `null` |
| Tool call failed (`status !== "SUCCEEDED"`) | Caller's responsibility; component just renders what it gets |
| `docName` is null | Falls back to `"Document {docId}"` |
| `path` is null | Falls back to `"(section {sectionId})"` |
| `title` is null | Omits `" — {title}"` portion |
| `referredFromSectionId` is null | Omits reference chain entirely |
| `referredFrom*` non-null but names null | Shows `"(from section {id})"` |
| Old records (no `sourcesJson` field) | API returns `null`, treated same as null case |

---

## Files Changed

| File | Change |
|---|---|
| `src/api.ts` | Add `sourcesJson?: string \| null` to `ToolCallAudit` type |
| `src/components/ui.tsx` | Add `SourcesList` component |
| `src/pages/TraceLogsPage.tsx` | Import and render `<SourcesList sourcesJson={tc.sourcesJson} />` |

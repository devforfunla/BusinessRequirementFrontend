# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps
npm run dev          # vite dev server on :5173, proxies /api -> http://localhost:8080
npm run build        # tsc -b && vite build (typecheck is part of build, not separate)
npm run lint         # eslint .
npm run preview      # serve the built dist/
```

There is **no test runner configured**. Don't add one without asking. Verification = `npm run lint && npm run build`.

## Stack & Conventions

- React 19 + TypeScript + Vite 8 + Tailwind v4 + React Router 7 + TanStack Query 5 + Zustand 5 + Axios + Sonner + Lucide.
- Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js`); styles live in `src/index.css` starting with `@import "tailwindcss"`.
- `tsconfig.app.json` has `verbatimModuleSyntax: true` — use `import type` for type-only imports. Also `erasableSyntaxOnly: true` (no TS enums or constructor parameter properties) and `noUnusedLocals`/`noUnusedParameters`.
- Design system is hand-rolled in `src/components/ui.tsx` using hardcoded hex colors (e.g. `#1f6feb` primary, `#172033` text, `#079455` approved-green). There is no token/theme layer. `cn()` from `src/utils.ts` merges `clsx` + `tailwind-merge`.
- Toasts via `sonner`. Standard pattern: `toast.success(...)` on mutation success, `toast.error(getErrorMessage(error))` on failure.

## Architecture

### Backend contract (single source of truth: `src/api.ts`)

All HTTP calls and domain types live in `src/api.ts`. The axios client uses `baseURL: '/api/v1'`. Path prefixes map to backend services:

| Prefix                  | Service              | Used for                                       |
|-------------------------|----------------------|------------------------------------------------|
| `/business-analysis/...`| documents + jobs     | `documentsApi`, `jobsApi`                      |
| `/semantic-analysis/...`| semantic rules       | `semanticMakerApi`, `semanticRulesApi`, `semanticCheckerApi` |
| `/atomic-analysis/...`  | atomic rules + workflows | `atomicMakerApi`, `atomicRulesApi`, `atomicCheckerApi`, `rewriteApi`, `workflowsApi` |
| `/skills`               | shared skills        | `skillsApi` (no service prefix)                |
| `/application-logs`, `/trace/...` | ops logs     | `applicationLogsApi`, `traceLogsApi`           |

Always `encodeURIComponent` path params. Use the existing helpers: `isJobRunning`, `isJobDone`, `getErrorMessage`, `parseJsonText`, `getSemanticRuleCode`, `getAtomicRuleCode`, etc.

### Async job pattern (central to this app)

Long-running operations return `{ jobId }`. The flow:

1. Mutation calls API → gets `jobId` → component stores it in `activeJobId` state.
2. `usePolledJob(activeJobId)` (in `src/hooks.ts`) polls `jobsApi.get(jobId)` every 2s while status is `QUEUED`/`RUNNING`, stops on terminal status.
3. A `useEffect` watches `jobQuery.data` and on `SUCCEEDED` calls `queryClient.invalidateQueries()` + clears `activeJobId`; on `FAILED` toasts the error message.
4. Separately, `jobsQuery` (list jobs by workflow) self-polls every 2s when any job is running, 5s otherwise — used to render the per-stage job cards.

The frontend never runs maker/checker inline; it always queues a job and waits. Approval gates: cannot run Atomic Maker until **all** semantic rules are `APPROVED`; the "Proceed to Atomic" button calls `semanticRulesApi.approvalStatus(workflowId)` and only navigates when `canProceed` is true.

### Workflow domain

Two-phase rule pipeline: **Document → Transform → Semantic Maker → Semantic Checker → approve all → Atomic Maker → Atomic Checker → Test Cases**. Each workflow has jobs, semantic rules, atomic rules (each with `llmOutputJson` and a parallel `llm*` shadow field), and checker runs/results. Rewrite jobs come in two modes: `CHECKER_FEEDBACK` (no human input) and `HUMAN_FEEDBACK` (requires `humanFeedback` text). Human edits use `editByHuman` with a JSON object payload.

### State

- `src/store.ts` — Zustand store with `persist` middleware, key `business-requirement-ui` in localStorage. Persists `reviewerId` (default `'reviewer-poc'`), `selectedDocumentId`, `selectedWorkflowId`. Reviewer ID is editable in both the sidebar and header of `AppShell` and is sent on most mutations as the actor.
- TanStack Query client (`src/main.tsx`) has `staleTime: 15_000`, `retry: 1`. Query keys follow `['entity-type', workflowIdOrDocumentId, ...]` — keep this convention so invalidations work.

### Routing & layout

`src/App.tsx` defines a single `AppShell` layout route with nested page routes. `/` redirects to `/documents`. Workflow pages live under `/workflows/:workflowId/{semantic,atomic,test-cases,approval,history}` and share the `WorkflowStagePipeline` + `WorkflowStageJobs` components. `WorkflowOverviewPage` is just a redirect to `/semantic`.

### Optimistic updates

The semantic approve/approve-all mutations in `SemanticStagePage` use TanStack Query's `onMutate` to update the cache before the server responds, with rollback in `onError`. Follow this pattern for new approval-style mutations on that page.

## Files worth knowing

- `src/api.ts` — all API calls and domain types (one large file, intentionally).
- `src/components/ui.tsx` — Button/Panel/TextInput/StatusPill/JsonViewButton/JsonDrawer etc. The `JsonDrawer` does its own JSON syntax highlighting via regex.
- `src/components/WorkflowStagePipeline.tsx` — the 3-step progress indicator (semantic → atomic → test-cases).
- `src/components/WorkflowStageJobs.tsx` — `WorkflowStageJobs` (filtered job list) and `JobSummaryCard`.
- `src/workflowJobUtils.ts` — `latestJob(jobs, jobType)` helper.

## Vite dev proxy

`/api` is proxied to `http://localhost:8080` (see `vite.config.ts`). The backend must be running there for any API call to succeed. There is no mock layer.

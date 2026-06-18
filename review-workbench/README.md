# TCG Review Workbench

Read-only React and TypeScript client for `TCG-NEXT-08`.

## Run

Start the Spring Boot service on port `8081`, then:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` and enter a workflow ID. The Vite development
server proxies `/api` requests to the Spring service.

## Verify

```powershell
npm test
npm run build
```

## Boundary

The client reads persisted Rules, Test Intents, Test Cases, checker/confidence
records, BDD drafts, workflow metadata, and jobs. It does not submit generation
or review mutations and does not implement export, scripts, execution, RAG, or
downstream integrations.

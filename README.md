# Business Requirement Frontend

React + TypeScript frontend for the Business Requirement Service POC.

## Flow

- Upload a source document and transform it to markdown.
- Run semantic rule extraction and semantic checker.
- Review and approve semantic rules.
- Run atomic rule generation and atomic checker.
- Review, edit, rewrite, and approve atomic rules.
- Manage shared skills through `/api/v1/skills`.

## Development

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8080`.

## Verification

```bash
npm run lint
npm run build
```

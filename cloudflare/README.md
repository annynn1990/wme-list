# Cloudflare Pages + Functions + D1

## One-time Cloudflare setup

1. Create a Pages project connected to `annynn1990/wme-list`, production branch `main`.
2. Set build command to empty and output directory to `.` (repository root).
3. Create D1 database `wme-list-db`.
4. In Pages > Settings > Functions, create D1 binding: variable name `DB`, database `wme-list-db`.
5. Add Pages Secret `WME_EDIT_PASSWORD` using the existing editor password.
6. Run `cloudflare/migrations/0001_create_wme_documents.sql` once in D1 Console.
7. Redeploy Pages and check `/api/health`; both flags must be true.

## API

- GET/POST/PUT `/api/privy`
- GET/POST/PUT `/api/cabinet`
- GET `/api/health`

The original HTML editing interface remains. The API saves header/table/footer to D1; no GitHub token or browser localStorage is used.

The migration imports exact current `data.json` and `cabinet.json` source documents with INSERT OR IGNORE. It does not replace existing D1 rows. GitHub Pages + Render remain as fallback until Cloudflare Pages is configured and tested.

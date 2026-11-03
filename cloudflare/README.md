# wme-list Cloudflare Worker

## Production Worker

- Base URL: https://wme-list-site.annynn1990.workers.dev
- Privy Council: /privy.html
- Cabinet: /cabinet.html
- Health: /api/health
- API: GET/POST/PUT /api/privy and /api/cabinet

## Bindings

- D1 binding: `DB` → database `wme-list-db`
- Secret binding: `WME_EDIT_PASSWORD`
- Source entry: `cloudflare/worker.js`

The Worker serves the two existing HTML editor pages and proxies their read/verify/save requests to D1. It does not use localStorage or a browser GitHub token. The Pages Git integration is not required for this Worker deployment.

## Database

Initial migration: `migrations/0001_create_wme_documents.sql`.
The current D1 database contains the `privy` and `cabinet` rows. The migration uses INSERT OR IGNORE to avoid overwriting them.

## Deployment

The Worker is deployed directly through the Cloudflare Workers API. Bindings and secret are configured at upload time. When HTML or Worker code changes, update `cloudflare/worker.js` and upload a new Worker version with the same bindings.

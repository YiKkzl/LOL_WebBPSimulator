# Final State

Phase 8 completes the migration from the root-level PHP and vanilla JavaScript implementation to the Next.js stack.

## Runtime Ownership

- The application runtime is Next.js App Router.
- The browser UI is implemented with React components under `app/` and `src/components/`.
- Domain behavior lives in TypeScript modules under `src/domain/`.
- MySQL access goes through Prisma-backed repositories under `src/server/repositories/`.
- The compatibility API remains available at `/api.php?action=...` through the Next.js rewrite to `app/api/legacy/route.ts`.

## Removed Root Legacy Files

The root-level legacy runtime files have been removed:

- `index.html`
- `script.js`
- `style.css`
- `api.php`
- `db_config.php`

The static frontend archive remains under `public/legacy/` for reference and emergency static fallback. It is no longer the primary application entry.

## Compatibility Guarantees

- Existing role links using `/?session=...&role=blue|red|observer|referee` continue to resolve through the Next.js root page.
- Existing global BP links using `/?mode=distribute&game=N&global_session=...` continue to resolve through the Next.js root page.
- Direct `/index.html` visits redirect to `/`.
- `/api.php?action=...` remains the public API compatibility path and is served by Next.js, not PHP.
- Database history is retained. Phase 8 does not delete data and does not restructure `global_games`.

## Operational Notes

- Use `DATABASE_URL` to point Prisma at the target MySQL database.
- Local development and automated tests use the Docker Compose `lolbp-mysql` service.
- The final acceptance suite is:

```powershell
npm run lint
npm run typecheck
npm run test
npm run e2e
npm run build
```

# Codex Project Instructions

This repository is being migrated in phases from PHP + vanilla JavaScript + MySQL to Next.js + React + TypeScript + Prisma + MySQL.

## Migration Boundaries

- Keep the legacy PHP/HTML/CSS/JS files until a later cleanup phase:
  - `api.php`
  - `db_config.php`
  - `index.html`
  - `script.js`
  - `style.css`
- Do not delete or rewrite legacy behavior while adding the modern stack.
- Keep `/api.php?action=...` compatibility until the migration plan explicitly removes it.
- Prefer small, separately verifiable phases over broad rewrites.

## Secrets And Databases

- Do not read, print, or modify production database credentials.
- Do not connect to the production MySQL server from Codex.
- Do not create or modify `.env` with real secrets.
- Use `.env.example` for documented local defaults.
- Use the Docker MySQL service from `docker-compose.yml` for local development and tests.

Local development database:

```text
mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test
```

## Target Stack

- Next.js App Router
- React
- TypeScript
- Prisma
- MySQL
- Playwright for browser/e2e coverage
- Browser or Playwright MCP for UI debugging when available
- Context7 MCP for current framework documentation when available

## Frontend Standards

- Build app surfaces directly, not landing pages, unless the user asks for a landing page.
- Follow existing user workflows first: competitive BP, global BP, role links, observer/referee behavior.
- Keep operational UI dense, scannable, and restrained.
- Add loading, empty, error, and disabled states for new React UI.
- Do not introduce shadcn/ui until the Next.js scaffold exists and `components.json` can be generated.

## Verification Expectations

Use the narrowest useful checks for the phase being changed. Prefer:

```powershell
docker compose up -d lolbp-mysql
npm run lint
npm run typecheck
npm run test
npm run e2e
npm run build
php -l api.php
```

Only run commands that exist in the current phase of the repo.

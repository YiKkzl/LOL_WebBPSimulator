# Codex Toolchain For Modernization

This document records the Codex toolchain for migrating LOL_WebBPSimulator from PHP + vanilla JavaScript + MySQL to Next.js + React + TypeScript + Prisma + MySQL.

## Detected Environment

Global Codex config:

```text
C:\Users\Administrator\.codex\config.toml
```

Detected enabled plugins:

- `browser@openai-bundled`
- `chrome@openai-bundled`
- `github@openai-curated`
- `documents@openai-primary-runtime`
- `spreadsheets@openai-primary-runtime`
- `presentations@openai-primary-runtime`

Detected built-in skills:

- `imagegen`
- `openai-docs`
- `plugin-creator`
- `skill-creator`
- `skill-installer`
- Browser, documents, presentations, and spreadsheets plugin skills are also available in this Codex session.

Detected MCP servers:

- `node_repl`
- `playwright`
- `context7`
- `mysql`

Detected app connectors/tools:

- GitHub connector tools are available in this session.

## Enabled During Setup

- `github@openai-curated` was enabled through Codex's plugin installer.
- In this same session, a GitHub connector probe timed out during MCP handshake. Restart Codex if GitHub tools do not respond immediately after setup.
- `playwright` skill was installed to `C:\Users\Administrator\.codex\skills\playwright`.
- `shadcn` skill was installed through the `skills` CLI and copied to `C:\Users\Administrator\.codex\skills\shadcn`.
- MCP packages were installed globally under `C:\Users\Administrator\AppData\Roaming\npm`.
- `playwright`, `context7`, and `mysql` MCP servers were added to `C:\Users\Administrator\.codex\config.toml`.
- Config backup created at `C:\Users\Administrator\.codex\config.toml.bak-mcp-20260528-012320`.

## Project-Level Configuration Added

- `AGENTS.md`
- `.env.example`
- `docs/tooling/codex-toolchain.md`

Existing local database support:

- `docker-compose.yml` provides a Docker MySQL test database on `127.0.0.1:3307`.
- `docker/mysql/init/002-readonly-user.sql` creates a read-only `lolbp_ro` account for MySQL MCP schema inspection.

## Requested Tools Status

| Tool | Status | Notes |
| --- | --- | --- |
| OpenAI build-web-apps plugin / skills | Not available from the current plugin installer | `openai/skills` currently exposes `playwright` but no exact `build-web-apps` skill in the checked paths. |
| frontend-app-builder | Not available by exact name | No matching official skill/plugin was found in the checked `openai/skills` paths. |
| frontend-testing-debugging | Partially covered | Official `playwright` skill and Playwright MCP are installed. No exact skill with this name was found. |
| react-best-practices | Not available by exact name | No official installed skill with this exact name was found. Use project `AGENTS.md` plus Context7 docs for React/Next guidance. |
| shadcn-best-practices | Installed as `shadcn` skill | Installed from `shadcn/ui`; use after the Next.js scaffold and `components.json` exist. |
| GitHub MCP / connector | Enabled | GitHub connector tools are callable, and `github@openai-curated` is enabled. |
| Playwright MCP | Installed and configured | Uses global `playwright-mcp.cmd`. |
| MySQL MCP | Installed and configured | Uses Docker MySQL read-only `lolbp_ro` account. |
| Context7 MCP | Installed and configured | Uses global `context7-mcp.cmd` without an API key. |

## Installed Commands

Installed globally:

```powershell
npm install -g @playwright/mcp@latest @upstash/context7-mcp@latest @matpb/mysql-mcp-server@latest
python C:\Users\Administrator\.codex\skills\.system\skill-installer\scripts\install-skill-from-github.py --repo openai/skills --path skills/.curated/playwright --method git
npx -y skills add shadcn/ui -g --skill shadcn --agent codex -y --copy
```

MCP config location:

```text
C:\Users\Administrator\.codex\config.toml
```

### Playwright MCP

```toml
[mcp_servers.playwright]
command = 'C:\Users\Administrator\AppData\Roaming\npm\playwright-mcp.cmd'
args = ['--headless', '--isolated']
startup_timeout_sec = 60
```

### Context7 MCP

Local stdio transport:

```toml
[mcp_servers.context7]
command = 'C:\Users\Administrator\AppData\Roaming\npm\context7-mcp.cmd'
args = []
startup_timeout_sec = 60
```

Do not add an API key to this repository.

### MySQL MCP

Use only the local Docker database. Prefer a read-only MCP server and the read-only Docker user:

```toml
[mcp_servers.mysql]
command = 'C:\Users\Administrator\AppData\Roaming\npm\mysql-mcp-server.cmd'
args = []
startup_timeout_sec = 60

[mcp_servers.mysql.env]
MYSQL_HOST = '127.0.0.1'
MYSQL_PORT = '3307'
MYSQL_USER = 'lolbp_ro'
MYSQL_PASSWORD = 'lolbp_readonly_password'
MYSQL_DATABASE = 'lolbp_test'
```

Do not point this MCP server at the production MySQL host.

## Verification

Session checks already performed:

- `docker compose config` parsed successfully.
- `github@openai-curated` is present in `C:\Users\Administrator\.codex\config.toml`.
- Direct GitHub connector probe timed out during MCP startup in the same session; retry after restarting Codex.
- `C:\Users\Administrator\.codex\config.toml` parses as valid TOML after MCP updates.
- Global npm packages are installed: `@playwright/mcp@0.0.75`, `@upstash/context7-mcp@3.0.0`, `@matpb/mysql-mcp-server@2.0.0`.
- MCP command help/startup checks completed for Playwright, Context7, and MySQL.
- `openai/skills` list API returned HTTP 403, so official skill discovery used a sparse Git clone instead.
- Exact `skills add --list` probes for `build-web-apps`, `frontend-app-builder`, `frontend-testing-debugging`, and `react-best-practices` failed because those package/repository names do not exist as direct `skills` sources.

### Docker MySQL

```powershell
docker compose up -d lolbp-mysql
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SHOW TABLES;"
```

Expected tables include:

- `bp_sessions`
- `session_activity`

### GitHub Connector

In Codex, ask for the authenticated GitHub user or repository metadata. The GitHub connector should respond without requiring shell access.

### Browser Plugin

After a local dev server exists:

```powershell
npm run dev
```

Then ask Codex to open `http://127.0.0.1:3000` with the in-app browser and inspect the page.

### Playwright MCP

After adding the MCP config and restarting Codex, ask Codex to navigate to a local page with Playwright MCP. If the MCP server is unavailable, fall back to the bundled Browser plugin.

### Context7 MCP

After adding the MCP config and restarting Codex, ask for current Next.js App Router or Prisma documentation through Context7.

### MySQL MCP

After adding the MCP config and restarting Codex, start Docker MySQL and ask the MySQL MCP to list tables in `lolbp_test`. It must not connect to any production host.

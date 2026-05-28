# Legacy Baseline

This document records the Phase 0 baseline for the legacy LOL_WebBPSimulator implementation. Phase 0 is documentation-only for business behavior: it does not move, reformat, or change `index.html`, `script.js`, `style.css`, `api.php`, or `db_setup.sql`.

## Source Boundary

- Canonical legacy source directory: `LOL_WebBPSimulator/`.
- Files in the parent directory are treated as deployment copies or older copies, not as the migration baseline.
- Legacy frontend entry: `index.html`.
- Legacy stylesheet: `style.css`.
- Legacy browser logic: `script.js`.
- Legacy API entry: `api.php`.
- Legacy schema bootstrap: `db_setup.sql`.
- Local test database container: `docker-compose.yml`.

## Runtime Stack

- Frontend: static HTML, CSS, and browser JavaScript.
- Backend: PHP with `mysqli`, loaded through `api.php`.
- Database: MySQL tables `bp_sessions` and `session_activity`; `global_games` is created lazily by `api.php` when a global session is created.
- Champion data: Riot Data Dragon is loaded by the browser at runtime:
  - `https://ddragon.leagueoflegends.com/api/versions.json`
  - `https://ddragon.leagueoflegends.com/cdn/{version}/data/zh_CN/champion.json`
  - champion portraits under `https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{championId}.png`

## URL And Role Model

- Home page: `index.html` with no query string.
- Role session URL: `?session={session_id}&role=blue|red|observer|referee`.
- Global BP distribution URL: `?mode=distribute&game={1..5}&global_session={global_session_id}`.
- Global BP role URL: `?session={session_id}&role={role}&game={1..5}&global_session={global_session_id}`.
- Session ids are generated in the browser as `Math.random().toString(36).substring(2, 10)`.
- Global session ids append `_global` to a generated session id.

## User Roles

- `host`: created when starting a new local session; can operate any turn.
- `blue`: can operate only when `whos_turn` is `blue`.
- `red`: can operate only when `whos_turn` is `red`.
- `observer`: read-only; champion selection and empty ban are disabled.
- `referee`: can operate turns and can system-ban or unban champions through the referee panel.

## Competitive And Global BP Flow

The exposed UI starts either competitive BP or global BP. Global BP uses the same competitive pick/ban sequence for each game.

| Step range | Phase | Turn order |
| --- | --- | --- |
| 0-5 | `ban1` | Blue, Red, Blue, Red, Blue, Red |
| 6-11 | `pick1` | Blue, Red, Red, Blue, Blue, Red |
| 12-15 | `ban2` | Red, Blue, Red, Blue |
| 16-19 | `pick2` | Red, Blue, Blue, Red |
| 20+ | `finished` | no active turn |

Each side has 5 ban slots and 5 pick slots in competitive/global mode.

## Selection Rules

- A normal champion selection first becomes `pendingChampionId`; the user must confirm it.
- A selected or banned champion cannot be selected again.
- Empty ban is allowed only when `action_type` is `ban`.
- Empty bans are stored as unique ids matching `EmptyBan_{timestamp}`.
- Empty bans do not count as real champion ids for system-banned champions.
- The turn advances after confirm or empty ban, then the current session is saved through `api.php?action=updateSession`.

## Global BP Behavior

- Creating global BP first creates one `global_games` row through `createGlobalSession`.
- The browser creates or repairs up to five child BP sessions and writes them into `session_id1` through `session_id5`.
- Game distribution pages generate blue, red, referee, and observer links for a specific game.
- For Game 2 and later, previous games' blue and red picks become `system_banned_champions`.
- System-banned champions are shown as unavailable in later games.
- When a global game reaches `finished`, its `session_id` is saved back to `global_games`.

## Synchronization Behavior

- Browser state is persisted through `api.php`.
- Session reads use `GET /api.php?action=getSession&session_id={id}&_t={timestamp}` to avoid browser caching.
- Joined sessions poll by repeatedly calling `loadSessionData()` with a short `setTimeout` delay.
- `last_updated` is used by the browser to skip unnecessary UI updates when the server row has not changed.
- `session_activity` records `updateSession` operations with the caller role and the submitted payload.

## Phase 0 Verification

Run these commands from `LOL_WebBPSimulator/`:

```powershell
git status --short
docker compose up -d lolbp-mysql
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SHOW TABLES;"
php -l api.php
```

Expected local schema after container initialization includes `bp_sessions` and `session_activity`. `global_games` appears after the first successful `createGlobalSession` API call.

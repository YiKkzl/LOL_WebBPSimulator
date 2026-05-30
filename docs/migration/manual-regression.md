# Manual Regression Checklist

Use this checklist before and after each migration phase that can affect legacy behavior. Phase 0 records the expected behavior; it does not automate these checks.

## Environment Setup

From `LOL_WebBPSimulator/`:

```powershell
docker compose up -d lolbp-mysql
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SHOW TABLES;"
php -l api.php
```

Serve the legacy app with the same PHP runtime that will load `api.php`. For a local smoke test:

```powershell
php -S 127.0.0.1:8000
```

Then open `http://127.0.0.1:8000/index.html`.

## Baseline Smoke Checks

- Home page shows `YiKkBP模拟器`.
- Mode buttons include `全局 BP 模式` and `竞技征召 BP`.
- Browser loads Riot Data Dragon champion data in Chinese.
- Champion search filters the champion pool.
- Champion tag filters render after data loading.
- `api.php` responses use `{ "status": "success", "data": ... }` or `{ "status": "error", "message": ... }`.

## Competitive BP

- Start `竞技征召 BP`.
- Verify 5 ban slots and 5 pick slots for each side.
- Verify generated share links for blue, red, referee, and observer roles.
- Complete this turn order:
  - Ban phase 1: Blue, Red, Blue, Red, Blue, Red.
  - Pick phase 1: Blue, Red, Red, Blue, Blue, Red.
  - Ban phase 2: Red, Blue, Red, Blue.
  - Pick phase 2: Red, Blue, Blue, Red.
- Verify the page reaches `BP 完成!` after step 19.
- Verify selected and banned champions cannot be selected again.
- During a ban turn, use `空 Ban`; verify the slot displays `空` and the turn advances.
- Verify timer starts at 30 seconds for active turns.

## Role Permissions

Open generated role links in separate browser tabs:

- Blue role can act only on blue turns.
- Red role can act only on red turns.
- Observer role cannot select champions or use empty ban.
- Observer role replaces the champion pool with blue/red splash banners grouped into Picks and Bans.
- Selecting a champion updates the pending champion label in every open role tab before confirmation.
- Confirmed bans briefly show a red prohibition symbol and remain grayscale; empty bans render a placeholder banner.
- Referee role can open referee controls.
- Referee can system-ban and unban a champion.
- System-banned champions appear unavailable to other roles after sync.
- A move in one tab appears in other tabs after session refresh or polling.

## Session API And Persistence

- Starting a competitive BP creates a row in `bp_sessions`.
- Confirming a pick or ban updates `current_phase`, `current_step`, `whos_turn`, `action_type`, and the relevant JSON-string array.
- Selecting an unconfirmed champion updates `pending_champion_id`; confirming or empty banning clears it.
- `updateSession` inserts a row in `session_activity`.
- `GET getSession` returns decoded arrays for `blue_bans`, `red_bans`, `blue_picks`, and `red_picks`.
- Missing or unknown `session_id` returns an error response, not HTML.

Useful database checks:

```powershell
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SELECT session_id,current_mode,current_phase,current_step,whos_turn,action_type FROM bp_sessions ORDER BY last_updated DESC LIMIT 5;"
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SELECT session_id,action,action_by,created_at FROM session_activity ORDER BY id DESC LIMIT 5;"
```

## Global BP

- Start `全局 BP 模式`.
- Verify a global session id is displayed.
- Verify Game 1 through Game 5 buttons are available.
- Start Game 1 and verify a distribution page opens with blue, red, referee, and observer links.
- Complete or partially complete Game 1 with at least one blue pick and one red pick.
- Start Game 2 from the same global session.
- Verify Game 2 role links include `game=2` and `global_session={id}`.
- Verify Game 1 picks are shown as previous-game/system-banned champions in Game 2.
- Repeat for later games if needed; previous games' picks should accumulate as system bans.
- Verify `global_games.session_id1` through `session_id5` are populated as games are created.

Useful database check:

```powershell
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SELECT global_session_id,session_id1,session_id2,session_id3,session_id4,session_id5 FROM global_games ORDER BY updated_at DESC LIMIT 5;"
```

## API Error Checks

- `GET /api.php?action=getSession` returns `会话ID不能为空`.
- `GET /api.php?action=getSession&session_id=missing` returns `会话不存在`.
- `GET /api.php?action=getGlobalSession&global_session_id=missing` returns `全局游戏表不存在` before any global table is created, or `全局会话不存在` after the table exists.
- `POST /api.php?action=updateGlobalSessionWithGameId` with `game_number` outside `1..5` returns the legacy parameter error.
- Unknown actions return `无效的操作`.

## Phase Completion Criteria

- No legacy business files were moved, formatted, or edited.
- Docker local MySQL can initialize from `db_setup.sql`.
- The API and database contracts in this folder match the observed legacy implementation.
- Manual checks above are available for later migration phases.

# Legacy Database Contract

The Phase 0 database contract describes the schema that the migration must continue to read and write. Local migration testing uses the MySQL container from `docker-compose.yml` and the database `lolbp_test`.

## Local Connection

```powershell
$env:DATABASE_URL="mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
```

Container commands:

```powershell
docker compose up -d lolbp-mysql
docker compose ps
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SHOW TABLES;"
```

## Table: bp_sessions

Created by `db_setup.sql`.

| Column | Type | Nullability / default | Contract |
| --- | --- | --- | --- |
| `session_id` | `VARCHAR(20)` | primary key | Legacy BP session id. |
| `current_mode` | `VARCHAR(20)` | nullable | Browser values include `competitive` and `global`; `ranked` code exists but is not exposed by the current HTML. |
| `current_phase` | `VARCHAR(20)` | nullable | Values include `ban1`, `pick1`, `ban2`, `pick2`, `finished`; older ranked handler uses `ban` and `pick`. |
| `current_step` | `INT` | nullable | Zero-based BP step. Competitive/global finishes after step 19. |
| `whos_turn` | `VARCHAR(10)` | nullable | `blue`, `red`, or empty when finished. |
| `action_type` | `VARCHAR(10)` | nullable | `ban`, `pick`, or empty when finished. |
| `pending_champion_id` | `VARCHAR(64)` | nullable | Current unconfirmed champion selection. Cleared when the turn advances. |
| `blue_bans` | `TEXT` | nullable | JSON string array. Empty ban markers use `EmptyBan_{timestamp}`. |
| `red_bans` | `TEXT` | nullable | JSON string array. Empty ban markers use `EmptyBan_{timestamp}`. |
| `blue_picks` | `TEXT` | nullable | JSON string array of champion ids. |
| `red_picks` | `TEXT` | nullable | JSON string array of champion ids. |
| `system_banned_champions` | `TEXT` | nullable | JSON string array of champion ids system-banned by referee or previous global games. |
| `last_updated` | `TIMESTAMP` | default current timestamp, auto-updated | Browser uses this to avoid unnecessary session refreshes. |

Compatibility requirements:

- Do not convert `TEXT` JSON-string fields to MySQL `JSON` in early migration phases.
- Do not rename columns.
- Do not widen or normalize `session_id` semantics without a compatibility layer.
- Preserve `last_updated` behavior or provide an equivalent value in API responses.
- Apply the Prisma schema with `npx prisma db push` when upgrading an existing database so `pending_champion_id` is added without removing historical rows.

## Table: session_activity

Created by `db_setup.sql`.

| Column | Type | Nullability / default | Contract |
| --- | --- | --- | --- |
| `id` | `INT AUTO_INCREMENT` | primary key | Activity row id. |
| `session_id` | `VARCHAR(20)` | foreign key to `bp_sessions.session_id` | Session being updated. |
| `action` | `VARCHAR(50)` | nullable | Browser action label, defaulted by PHP to `update` if omitted. |
| `action_by` | `VARCHAR(20)` | nullable | Browser role, defaulted by PHP to `unknown` if omitted. |
| `action_data` | `TEXT` | nullable | Submitted `updateSession` JSON payload encoded as text. |
| `created_at` | `TIMESTAMP` | default current timestamp | Activity creation time. |

Compatibility requirements:

- Preserve the foreign key relationship to `bp_sessions`.
- Preserve activity logging on `updateSession`.
- Do not require a login user id; the legacy role string is the only actor field.

## Table: global_games

Not created by `db_setup.sql`. `api.php?action=createGlobalSession` creates this table lazily if it is missing.

Runtime DDL:

```sql
CREATE TABLE global_games (
    id INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    global_session_id VARCHAR(50) NOT NULL UNIQUE,
    session_id1 VARCHAR(50) NULL,
    session_id2 VARCHAR(50) NULL,
    session_id3 VARCHAR(50) NULL,
    session_id4 VARCHAR(50) NULL,
    session_id5 VARCHAR(50) NULL,
    created_at DATETIME NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```

Compatibility requirements:

- Preserve the five fixed columns `session_id1` through `session_id5` until a later phase explicitly migrates them.
- Preserve `global_session_id` as the lookup key for `getGlobalSession`.
- Preserve lazy table creation until compatibility tests cover replacement behavior.
- Do not normalize games into a child table in early migration phases.

## Bootstrap Expectations

After running only `docker compose up -d lolbp-mysql`, `SHOW TABLES;` should list the tables from `db_setup.sql`:

- `bp_sessions`
- `session_activity`

After the first successful `createGlobalSession` API request, `SHOW TABLES;` should also list:

- `global_games`

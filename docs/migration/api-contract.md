# Legacy API Contract

The legacy API entry is `api.php`. All actions are selected with the `action` query parameter. The endpoint responds with JSON and allows cross-origin `GET` and `POST` requests.

## Common Response Shape

Success:

```json
{
  "status": "success",
  "data": {}
}
```

Error:

```json
{
  "status": "error",
  "message": "错误信息"
}
```

Unsupported methods return `不支持的请求方法`. Unknown actions return `无效的操作`.

## GET getSession

Request:

```text
GET /api.php?action=getSession&session_id={session_id}
```

Required query fields:

- `session_id`: non-empty legacy BP session id.

Success data:

- Returns the matching `bp_sessions` row.
- `blue_bans`, `red_bans`, `blue_picks`, and `red_picks` are decoded from JSON strings to arrays.
- `system_banned_champions` is returned as stored by MySQL. Existing browser code accepts either an array or a JSON string.
- `pending_champion_id` returns the current unconfirmed champion id or `null`.

Errors:

- `会话ID不能为空`
- `会话不存在`

## POST createSession

Request:

```text
POST /api.php?action=createSession
Content-Type: application/json
```

Required JSON fields:

- `session_id`
- `current_mode`

Optional JSON fields:

- `current_phase`
- `current_step`
- `whos_turn`
- `action_type`
- `pending_champion_id`
- `blue_bans`
- `red_bans`
- `blue_picks`
- `red_picks`
- `system_banned_champions`
- `global_session_id` and `game_number` may be sent by the browser, but the PHP insert does not persist them in `bp_sessions`.

Persistence:

- Inserts a row into `bp_sessions`.
- Missing array fields are persisted as the string `[]`.
- Array fields are encoded with PHP `json_encode`.

Success data:

```json
{
  "session_id": "{session_id}",
  "message": "会话创建成功"
}
```

Errors:

- `无效的请求数据`
- `必填字段不能为空`
- `创建会话失败: {mysqli error}`

## POST updateSession

Request:

```text
POST /api.php?action=updateSession
Content-Type: application/json
```

Required JSON fields:

- `session_id`

Optional JSON fields:

- `current_mode`
- `current_phase`
- `current_step`
- `whos_turn`
- `action_type`
- `pending_champion_id`
- `blue_bans`
- `red_bans`
- `blue_picks`
- `red_picks`
- `system_banned_champions`
- `user_role`
- `action`
- `global_session_id`
- `game_number`

Persistence:

- Requires an existing `bp_sessions` row.
- Updates the current mode, phase, step, turn, action type, bans, picks, and system-banned champions.
- Missing scalar fields default to empty string or `0`.
- Missing array fields default to the string `[]`.
- Inserts one row into `session_activity` with:
  - `session_id`
  - `action`, default `update`
  - `action_by`, default `unknown`
  - `action_data`, the submitted JSON payload encoded as text

Success data:

```json
{
  "session_id": "{session_id}",
  "message": "会话更新成功"
}
```

Errors:

- `无效的请求数据`
- `会话ID不能为空`
- `会话不存在`
- `更新会话失败: {mysqli error}`

## POST updatePendingChampion

Request:

```text
POST /api.php?action=updatePendingChampion
Content-Type: application/json
```

Required JSON fields:

- `session_id`
- `expected_current_step`

Optional JSON fields:

- `pending_champion_id`: champion id, or `null` to clear the current pending selection.

Persistence:

- Updates only `bp_sessions.pending_champion_id`.
- Rejects stale step values and champions already present in picks, bans, or system bans.
- Does not insert a `session_activity` row.

Errors:

- `参数错误：会话ID和当前步骤不能为空`
- `会话不存在`
- `会话已更新，请刷新后重试`
- `英雄不可用，请重新选择`
- `更新待选英雄失败: {database error}`

## POST createGlobalSession

Request:

```text
POST /api.php?action=createGlobalSession
Content-Type: application/json
```

Required JSON fields:

- `global_session_id`

Persistence:

- If `global_games` does not exist, creates it at runtime.
- Inserts a row with `global_session_id` and current `created_at`.
- `global_session_id` is unique.

Runtime-created `global_games` columns:

- `id`
- `global_session_id`
- `session_id1`
- `session_id2`
- `session_id3`
- `session_id4`
- `session_id5`
- `created_at`
- `updated_at`

Success data:

```json
{
  "global_session_id": "{global_session_id}",
  "message": "全局会话创建成功"
}
```

Errors:

- `无效的请求数据`
- `全局会话ID不能为空`
- `创建全局游戏表失败: {mysqli error}`
- `创建全局会话失败: {mysqli error}`

## POST updateGlobalSessionWithGameId

Request:

```text
POST /api.php?action=updateGlobalSessionWithGameId
Content-Type: application/json
```

Required JSON fields:

- `global_session_id`
- `game_number`: integer from `1` through `5`
- `session_id`

Persistence:

- Requires an existing `global_games` row.
- Updates exactly one dynamic column: `session_id{game_number}`.

Success data:

```json
{
  "global_session_id": "{global_session_id}",
  "game_number": 1,
  "session_id": "{session_id}",
  "message": "全局会话游戏ID更新成功"
}
```

Errors:

- `无效的请求数据`
- `参数错误：全局会话ID不能为空，游戏编号必须在1-5之间，会话ID不能为空`
- `全局会话不存在`
- `更新全局会话游戏ID失败: {mysqli error}`

## GET getGlobalSession

Request:

```text
GET /api.php?action=getGlobalSession&global_session_id={global_session_id}
```

Required query fields:

- `global_session_id`

Success data:

- Returns the matching `global_games` row.

Errors:

- `全局会话ID不能为空`
- `全局游戏表不存在`
- `全局会话不存在`

## Compatibility Notes For Migration

- Preserve `/api.php?action=...` while adding the Next.js compatibility layer.
- Preserve snake_case field names.
- Preserve the success and error wrapper shapes exactly.
- Preserve PHP's loose defaulting behavior for omitted fields until tests prove it is safe to tighten validation.
- Preserve JSON-string storage for `blue_bans`, `red_bans`, `blue_picks`, `red_picks`, and `system_banned_champions`.
- Preserve lazy creation of `global_games` until a later phase explicitly replaces it with a migrated schema.

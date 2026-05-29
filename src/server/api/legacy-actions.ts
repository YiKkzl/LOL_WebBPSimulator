import type { PrismaClient } from "@prisma/client";

import { db } from "@/src/server/db";
import {
  createBpSession,
  findBpSessionById,
  type CreateBpSessionInput,
  type LegacyBpSessionRecord,
  updateBpSession,
} from "@/src/server/repositories/bp-session-repository";
import {
  createGlobalGame,
  findGlobalGameByGameSessionId,
  findGlobalGameByGlobalSessionId,
  type GlobalGameNumber,
  type LegacyGlobalGameSessionReference,
  type LegacyGlobalGameRecord,
  updateGlobalGameSessionId,
} from "@/src/server/repositories/global-game-repository";
import {
  createSessionActivity,
  type CreateSessionActivityInput,
} from "@/src/server/repositories/session-activity-repository";
import { legacyError, type LegacyApiResponse, legacySuccess } from "./legacy-response";
import {
  getQueryValue,
  isLegacyEmpty,
  legacyArrayField,
  legacyInt,
  type LegacyPostBody,
  legacyString,
} from "./validators";

export interface LegacyActionDependencies {
  findBpSessionById: (sessionId: string) => Promise<LegacyBpSessionRecord | null>;
  createBpSession: (input: CreateBpSessionInput) => Promise<LegacyBpSessionRecord>;
  updateBpSession: (input: CreateBpSessionInput) => Promise<LegacyBpSessionRecord>;
  createSessionActivity: (input: CreateSessionActivityInput) => Promise<unknown>;
  globalGamesTableExists: () => Promise<boolean>;
  ensureGlobalGamesTable: () => Promise<void>;
  findGlobalGameByGlobalSessionId: (
    globalSessionId: string,
  ) => Promise<LegacyGlobalGameRecord | null>;
  findGlobalGameByGameSessionId: (
    sessionId: string,
  ) => Promise<LegacyGlobalGameSessionReference | null>;
  createGlobalGame: (globalSessionId: string) => Promise<LegacyGlobalGameRecord>;
  updateGlobalGameSessionId: (
    globalSessionId: string,
    gameNumber: GlobalGameNumber,
    sessionId: string,
  ) => Promise<LegacyGlobalGameRecord>;
}

const defaultDependencies: LegacyActionDependencies = {
  findBpSessionById,
  createBpSession,
  updateBpSession,
  createSessionActivity,
  globalGamesTableExists: () => globalGamesTableExists(db),
  ensureGlobalGamesTable: () => ensureGlobalGamesTable(db),
  findGlobalGameByGlobalSessionId,
  findGlobalGameByGameSessionId,
  createGlobalGame,
  updateGlobalGameSessionId,
};

export async function handleLegacyAction(
  method: string,
  action: string,
  searchParams: URLSearchParams,
  body: LegacyPostBody | null = null,
  dependencies: LegacyActionDependencies = defaultDependencies,
): Promise<LegacyApiResponse> {
  if (method === "GET") {
    if (action === "getSession") {
      return getSession(searchParams, dependencies);
    }

    if (action === "getGlobalSession") {
      return getGlobalSession(searchParams, dependencies);
    }

    if (action === "getGlobalSessionForGameSession") {
      return getGlobalSessionForGameSession(searchParams, dependencies);
    }

    return legacyError("无效的操作");
  }

  if (method === "POST") {
    if (!body) {
      return legacyError("无效的请求数据");
    }

    if (action === "createSession") {
      return createSession(body, dependencies);
    }

    if (action === "updateSession") {
      return updateSession(body, dependencies);
    }

    if (action === "createGlobalSession") {
      return createGlobalSessionAction(body, dependencies);
    }

    if (action === "updateGlobalSessionWithGameId") {
      return updateGlobalSessionWithGameId(body, dependencies);
    }

    return legacyError("无效的操作");
  }

  return legacyError("不支持的请求方法");
}

async function getSession(
  searchParams: URLSearchParams,
  dependencies: LegacyActionDependencies,
): Promise<LegacyApiResponse> {
  const sessionId = getQueryValue(searchParams, "session_id");

  if (isLegacyEmpty(sessionId)) {
    return legacyError("会话ID不能为空");
  }

  const session = await dependencies.findBpSessionById(sessionId);
  if (!session) {
    return legacyError("会话不存在");
  }

  return legacySuccess(decodeSessionForRead(session));
}

async function createSession(
  body: LegacyPostBody,
  dependencies: LegacyActionDependencies,
): Promise<LegacyApiResponse> {
  const sessionId = body.session_id;
  const currentMode = body.current_mode;

  if (isLegacyEmpty(sessionId) || isLegacyEmpty(currentMode)) {
    return legacyError("必填字段不能为空");
  }

  try {
    await dependencies.createBpSession(toSessionInput(body));
    return legacySuccess({
      session_id: legacyString(sessionId),
      message: "会话创建成功",
    });
  } catch (error) {
    return legacyError(`创建会话失败: ${getErrorMessage(error)}`);
  }
}

async function updateSession(
  body: LegacyPostBody,
  dependencies: LegacyActionDependencies,
): Promise<LegacyApiResponse> {
  const sessionId = body.session_id;

  if (isLegacyEmpty(sessionId)) {
    return legacyError("会话ID不能为空");
  }

  const sessionIdString = legacyString(sessionId);
  const existing = await dependencies.findBpSessionById(sessionIdString);
  if (!existing) {
    return legacyError("会话不存在");
  }

  if (hasExpectedCurrentStep(body.expected_current_step)) {
    const expectedCurrentStep = legacyInt(body.expected_current_step);
    if ((existing.current_step ?? 0) !== expectedCurrentStep) {
      return legacyError("会话已更新，请刷新后重试");
    }
  }

  try {
    await dependencies.updateBpSession(toSessionInput(body));

    try {
      await dependencies.createSessionActivity({
        session_id: sessionIdString,
        action: legacyString(body.action, "update"),
        action_by: legacyString(body.user_role, "unknown"),
        action_data: JSON.stringify(body),
      });
    } catch {
      // The PHP API does not fail the session update when activity logging fails.
    }

    return legacySuccess({
      session_id: sessionIdString,
      message: "会话更新成功",
    });
  } catch (error) {
    return legacyError(`更新会话失败: ${getErrorMessage(error)}`);
  }
}

async function createGlobalSessionAction(
  body: LegacyPostBody,
  dependencies: LegacyActionDependencies,
): Promise<LegacyApiResponse> {
  const globalSessionId = body.global_session_id;

  if (isLegacyEmpty(globalSessionId)) {
    return legacyError("全局会话ID不能为空");
  }

  try {
    await dependencies.ensureGlobalGamesTable();
  } catch (error) {
    return legacyError(`创建全局游戏表失败: ${getErrorMessage(error)}`);
  }

  try {
    await dependencies.createGlobalGame(legacyString(globalSessionId));
    return legacySuccess({
      global_session_id: legacyString(globalSessionId),
      message: "全局会话创建成功",
    });
  } catch (error) {
    return legacyError(`创建全局会话失败: ${getErrorMessage(error)}`);
  }
}

async function updateGlobalSessionWithGameId(
  body: LegacyPostBody,
  dependencies: LegacyActionDependencies,
): Promise<LegacyApiResponse> {
  const globalSessionId = body.global_session_id;
  const gameNumber = legacyInt(body.game_number);
  const sessionId = body.session_id;

  if (
    isLegacyEmpty(globalSessionId) ||
    gameNumber <= 0 ||
    gameNumber > 5 ||
    isLegacyEmpty(sessionId)
  ) {
    return legacyError("参数错误：全局会话ID不能为空，游戏编号必须在1-5之间，会话ID不能为空");
  }

  const globalSessionIdString = legacyString(globalSessionId);
  const sessionIdString = legacyString(sessionId);
  const existing = await dependencies.findGlobalGameByGlobalSessionId(globalSessionIdString);

  if (!existing) {
    return legacyError("全局会话不存在");
  }

  try {
    await dependencies.updateGlobalGameSessionId(
      globalSessionIdString,
      gameNumber as GlobalGameNumber,
      sessionIdString,
    );

    return legacySuccess({
      global_session_id: globalSessionIdString,
      game_number: gameNumber,
      session_id: sessionIdString,
      message: "全局会话游戏ID更新成功",
    });
  } catch (error) {
    return legacyError(`更新全局会话游戏ID失败: ${getErrorMessage(error)}`);
  }
}

async function getGlobalSession(
  searchParams: URLSearchParams,
  dependencies: LegacyActionDependencies,
): Promise<LegacyApiResponse> {
  const globalSessionId = getQueryValue(searchParams, "global_session_id");

  if (isLegacyEmpty(globalSessionId)) {
    return legacyError("全局会话ID不能为空");
  }

  if (!(await dependencies.globalGamesTableExists())) {
    return legacyError("全局游戏表不存在");
  }

  const globalSession = await dependencies.findGlobalGameByGlobalSessionId(globalSessionId);
  if (!globalSession) {
    return legacyError("全局会话不存在");
  }

  return legacySuccess(globalSession);
}

async function getGlobalSessionForGameSession(
  searchParams: URLSearchParams,
  dependencies: LegacyActionDependencies,
): Promise<LegacyApiResponse> {
  const sessionId = getQueryValue(searchParams, "session_id");

  if (isLegacyEmpty(sessionId)) {
    return legacyError("会话ID不能为空");
  }

  if (!(await dependencies.globalGamesTableExists())) {
    return legacyError("全局游戏表不存在");
  }

  const reference = await dependencies.findGlobalGameByGameSessionId(sessionId);
  if (!reference) {
    return legacyError("全局会话不存在");
  }

  return legacySuccess({
    global_session_id: reference.global_session_id,
    game_number: reference.game_number,
    session_id: reference.session_id,
  });
}

function toSessionInput(body: LegacyPostBody): CreateBpSessionInput {
  return {
    session_id: legacyString(body.session_id),
    current_mode: legacyString(body.current_mode),
    current_phase: legacyString(body.current_phase),
    current_step: legacyInt(body.current_step),
    whos_turn: legacyString(body.whos_turn),
    action_type: legacyString(body.action_type),
    blue_bans: legacyArrayField(body.blue_bans),
    red_bans: legacyArrayField(body.red_bans),
    blue_picks: legacyArrayField(body.blue_picks),
    red_picks: legacyArrayField(body.red_picks),
    system_banned_champions: legacyArrayField(body.system_banned_champions),
  };
}

function decodeSessionForRead(session: LegacyBpSessionRecord): Record<string, unknown> {
  return {
    ...session,
    blue_bans: decodeLegacyJsonArray(session.blue_bans),
    red_bans: decodeLegacyJsonArray(session.red_bans),
    blue_picks: decodeLegacyJsonArray(session.blue_picks),
    red_picks: decodeLegacyJsonArray(session.red_picks),
  };
}

function decodeLegacyJsonArray(value: string | null): string[] | null {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : null;
  } catch {
    return null;
  }
}

function hasExpectedCurrentStep(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

async function globalGamesTableExists(client: PrismaClient): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ table_count: bigint }>>`
    SELECT COUNT(*) AS table_count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'global_games'
  `;

  return Number(rows[0]?.table_count ?? 0) > 0;
}

async function ensureGlobalGamesTable(client: PrismaClient): Promise<void> {
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS global_games (
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
  `);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import { describe, expect, it } from "vitest";

import {
  handleLegacyAction,
  type LegacyActionDependencies,
} from "../legacy-actions";
import type { CreateBpSessionInput } from "../../repositories/bp-session-repository";
import type { LegacyGlobalGameRecord } from "../../repositories/global-game-repository";

function createDependencies(): LegacyActionDependencies {
  const sessions = new Map();
  const globalGames = new Map<string, LegacyGlobalGameRecord>();
  const activity: unknown[] = [];
  const now = new Date("2026-01-02T03:04:05.000Z");
  let globalGamesTableCreated = false;

  return {
    async findBpSessionById(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async createBpSession(input) {
      const record = toSessionRecord(input, now);
      sessions.set(input.session_id, record);
      return record;
    },
    async updateBpSession(input) {
      const record = toSessionRecord(input, now);
      sessions.set(input.session_id, record);
      return record;
    },
    async updatePendingChampion(input) {
      const existing = sessions.get(input.session_id);
      const record = {
        ...existing,
        pending_champion_id: input.pending_champion_id,
      };
      sessions.set(input.session_id, record);
      return record;
    },
    async createSessionActivity(input) {
      activity.push(input);
      return input;
    },
    async globalGamesTableExists() {
      return globalGamesTableCreated;
    },
    async ensureGlobalGamesTable() {
      globalGamesTableCreated = true;
    },
    async findGlobalGameByGlobalSessionId(globalSessionId) {
      return globalGames.get(globalSessionId) ?? null;
    },
    async findGlobalGameByGameSessionId(sessionId) {
      for (const record of globalGames.values()) {
        for (const gameNumber of [1, 2, 3, 4, 5] as const) {
          if (record[`session_id${gameNumber}`] === sessionId) {
            return {
              ...record,
              game_number: gameNumber,
              session_id: sessionId,
            };
          }
        }
      }

      return null;
    },
    async createGlobalGame(globalSessionId) {
      const record: LegacyGlobalGameRecord = {
        id: globalGames.size + 1,
        global_session_id: globalSessionId,
        session_id1: null,
        session_id2: null,
        session_id3: null,
        session_id4: null,
        session_id5: null,
        created_at: now,
        updated_at: now,
      };
      globalGames.set(globalSessionId, record);
      return record;
    },
    async updateGlobalGameSessionId(globalSessionId, gameNumber, sessionId) {
      const record = globalGames.get(globalSessionId);
      if (!record) {
        throw new Error("missing global session");
      }

      const updated = {
        ...record,
        [`session_id${gameNumber}`]: sessionId,
        updated_at: now,
      } as LegacyGlobalGameRecord;
      globalGames.set(globalSessionId, updated);
      return updated;
    },
  };
}

describe("legacy API actions", () => {
  it("preserves legacy errors for invalid method and action", async () => {
    const dependencies = createDependencies();

    await expect(
      handleLegacyAction("DELETE", "", new URLSearchParams(), null, dependencies),
    ).resolves.toEqual({
      status: "error",
      message: "不支持的请求方法",
    });

    await expect(
      handleLegacyAction("GET", "missing", new URLSearchParams(), null, dependencies),
    ).resolves.toEqual({
      status: "error",
      message: "无效的操作",
    });
  });

  it("creates and reads a BP session with decoded ban and pick arrays", async () => {
    const dependencies = createDependencies();

    await expect(
      handleLegacyAction(
        "POST",
        "createSession",
        new URLSearchParams(),
        {
          session_id: "test",
          current_mode: "competitive",
          current_phase: "ban1",
          current_step: 1,
          whos_turn: "red",
          action_type: "ban",
          pending_champion_id: "Lux",
          blue_bans: ["Ahri"],
          red_bans: [],
          blue_picks: ["Ashe"],
          red_picks: [],
          system_banned_champions: ["Akali"],
        },
        dependencies,
      ),
    ).resolves.toEqual({
      status: "success",
      data: {
        session_id: "test",
        message: "会话创建成功",
      },
    });

    await expect(
      handleLegacyAction(
        "GET",
        "getSession",
        new URLSearchParams("session_id=test"),
        null,
        dependencies,
      ),
    ).resolves.toEqual({
      status: "success",
      data: {
        session_id: "test",
        current_mode: "competitive",
        current_phase: "ban1",
        current_step: 1,
        whos_turn: "red",
        action_type: "ban",
        pending_champion_id: "Lux",
        blue_bans: ["Ahri"],
        red_bans: [],
        blue_picks: ["Ashe"],
        red_picks: [],
        system_banned_champions: "[\"Akali\"]",
        last_updated: "2026-01-02 03:04:05",
      },
    });
  });

  it("updates an existing BP session and records activity", async () => {
    const dependencies = createDependencies();

    await handleLegacyAction(
      "POST",
      "createSession",
      new URLSearchParams(),
      {
        session_id: "test",
        current_mode: "competitive",
      },
      dependencies,
    );

    await expect(
      handleLegacyAction(
        "POST",
        "updateSession",
        new URLSearchParams(),
        {
          session_id: "test",
          current_mode: "competitive",
          current_step: "2",
          user_role: "blue",
          action: "select",
          blue_bans: ["Ahri", "Akali"],
        },
        dependencies,
      ),
    ).resolves.toEqual({
      status: "success",
      data: {
        session_id: "test",
        message: "会话更新成功",
      },
    });

    await expect(
      handleLegacyAction(
        "GET",
        "getSession",
        new URLSearchParams("session_id=test"),
        null,
        dependencies,
      ),
    ).resolves.toMatchObject({
      status: "success",
      data: {
        current_step: 2,
        blue_bans: ["Ahri", "Akali"],
        red_bans: [],
      },
    });
  });

  it("rejects stale BP session updates before overwriting state", async () => {
    const dependencies = createDependencies();

    await handleLegacyAction(
      "POST",
      "createSession",
      new URLSearchParams(),
      {
        session_id: "test",
        current_mode: "competitive",
        current_step: 1,
        red_bans: ["Ahri"],
      },
      dependencies,
    );

    await expect(
      handleLegacyAction(
        "POST",
        "updateSession",
        new URLSearchParams(),
        {
          session_id: "test",
          current_mode: "competitive",
          current_step: 1,
          expected_current_step: 0,
          blue_bans: ["Akali"],
          red_bans: [],
        },
        dependencies,
      ),
    ).resolves.toEqual({
      status: "error",
      message: "会话已更新，请刷新后重试",
    });

    await expect(
      handleLegacyAction(
        "GET",
        "getSession",
        new URLSearchParams("session_id=test"),
        null,
        dependencies,
      ),
    ).resolves.toMatchObject({
      status: "success",
      data: {
        current_step: 1,
        blue_bans: [],
        red_bans: ["Ahri"],
      },
    });
  });

  it("updates only the pending champion and rejects stale lightweight updates", async () => {
    const dependencies = createDependencies();

    await handleLegacyAction(
      "POST",
      "createSession",
      new URLSearchParams(),
      {
        session_id: "test",
        current_mode: "competitive",
        current_step: 1,
        red_bans: ["Ahri"],
      },
      dependencies,
    );

    await expect(
      handleLegacyAction(
        "POST",
        "updatePendingChampion",
        new URLSearchParams(),
        {
          session_id: "test",
          pending_champion_id: "Akali",
          expected_current_step: 1,
        },
        dependencies,
      ),
    ).resolves.toMatchObject({
      status: "success",
      data: {
        session_id: "test",
        pending_champion_id: "Akali",
      },
    });

    await expect(
      handleLegacyAction(
        "GET",
        "getSession",
        new URLSearchParams("session_id=test"),
        null,
        dependencies,
      ),
    ).resolves.toMatchObject({
      status: "success",
      data: {
        current_step: 1,
        pending_champion_id: "Akali",
        red_bans: ["Ahri"],
      },
    });

    await expect(
      handleLegacyAction(
        "POST",
        "updatePendingChampion",
        new URLSearchParams(),
        {
          session_id: "test",
          pending_champion_id: "Ashe",
          expected_current_step: 0,
        },
        dependencies,
      ),
    ).resolves.toEqual({
      status: "error",
      message: "会话已更新，请刷新后重试",
    });
  });

  it("rejects unavailable pending champions", async () => {
    const dependencies = createDependencies();

    await handleLegacyAction(
      "POST",
      "createSession",
      new URLSearchParams(),
      {
        session_id: "test",
        current_mode: "competitive",
        current_step: 0,
        system_banned_champions: ["Akali"],
      },
      dependencies,
    );

    await expect(
      handleLegacyAction(
        "POST",
        "updatePendingChampion",
        new URLSearchParams(),
        {
          session_id: "test",
          pending_champion_id: "Akali",
          expected_current_step: 0,
        },
        dependencies,
      ),
    ).resolves.toEqual({
      status: "error",
      message: "英雄不可用，请重新选择",
    });
  });

  it("returns the legacy missing-session error before update", async () => {
    await expect(
      handleLegacyAction(
        "POST",
        "updateSession",
        new URLSearchParams(),
        { session_id: "missing" },
        createDependencies(),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "会话不存在",
    });
  });

  it("creates, updates, and reads a global session", async () => {
    const dependencies = createDependencies();

    await expect(
      handleLegacyAction(
        "POST",
        "createGlobalSession",
        new URLSearchParams(),
        { global_session_id: "global-test" },
        dependencies,
      ),
    ).resolves.toEqual({
      status: "success",
      data: {
        global_session_id: "global-test",
        message: "全局会话创建成功",
      },
    });

    await expect(
      handleLegacyAction(
        "POST",
        "updateGlobalSessionWithGameId",
        new URLSearchParams(),
        {
          global_session_id: "global-test",
          game_number: 3,
          session_id: "game-3",
        },
        dependencies,
      ),
    ).resolves.toEqual({
      status: "success",
      data: {
        global_session_id: "global-test",
        game_number: 3,
        session_id: "game-3",
        message: "全局会话游戏ID更新成功",
      },
    });

    await expect(
      handleLegacyAction(
        "GET",
        "getGlobalSession",
        new URLSearchParams("global_session_id=global-test"),
        null,
        dependencies,
      ),
    ).resolves.toMatchObject({
      status: "success",
      data: {
        global_session_id: "global-test",
        session_id3: "game-3",
        created_at: "2026-01-02 03:04:05",
      },
    });
  });

  it("finds global session context by child game session id", async () => {
    const dependencies = createDependencies();

    await handleLegacyAction(
      "POST",
      "createGlobalSession",
      new URLSearchParams(),
      { global_session_id: "global-test" },
      dependencies,
    );
    await handleLegacyAction(
      "POST",
      "updateGlobalSessionWithGameId",
      new URLSearchParams(),
      {
        global_session_id: "global-test",
        game_number: 4,
        session_id: "game-4",
      },
      dependencies,
    );

    await expect(
      handleLegacyAction(
        "GET",
        "getGlobalSessionForGameSession",
        new URLSearchParams("session_id=game-4"),
        null,
        dependencies,
      ),
    ).resolves.toEqual({
      status: "success",
      data: {
        global_session_id: "global-test",
        game_number: 4,
        session_id: "game-4",
      },
    });
  });

  it("validates global game number the same way as the legacy API", async () => {
    await expect(
      handleLegacyAction(
        "POST",
        "updateGlobalSessionWithGameId",
        new URLSearchParams(),
        {
          global_session_id: "global-test",
          game_number: 6,
          session_id: "game-6",
        },
        createDependencies(),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "参数错误：全局会话ID不能为空，游戏编号必须在1-5之间，会话ID不能为空",
    });
  });
});

function toSessionRecord(input: CreateBpSessionInput, now: Date) {
  return {
    session_id: input.session_id,
    current_mode: input.current_mode,
    current_phase: input.current_phase ?? "",
    current_step: input.current_step ?? 0,
    whos_turn: input.whos_turn ?? "",
    action_type: input.action_type ?? "",
    pending_champion_id: input.pending_champion_id ?? null,
    blue_bans: encodeArray(input.blue_bans),
    red_bans: encodeArray(input.red_bans),
    blue_picks: encodeArray(input.blue_picks),
    red_picks: encodeArray(input.red_picks),
    system_banned_champions: encodeArray(input.system_banned_champions),
    last_updated: now,
  };
}

function encodeArray(value: CreateBpSessionInput["blue_bans"]): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value ?? []);
}

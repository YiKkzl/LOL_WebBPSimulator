"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyChampionSelection,
  applyEmptyBan,
  getBpTurn,
  isChampionUnavailable,
  syncTurnFromStep,
} from "@/src/domain/bp-flow";
import { canRoleActOnTurn } from "@/src/domain/permissions";
import {
  collectPreviousGameSystemBans,
  createGlobalGameSessionState,
  createInitialSessionState,
} from "@/src/domain/session-state";
import type {
  BpMode,
  BpSessionState,
  ChampionId,
  PreviousGamesPicks,
  UserRole,
} from "@/src/domain/types";

const API_BASE_URL = "/api.php";

export interface UseBpSessionOptions {
  sessionId?: string | null;
  role?: UserRole | null;
  globalSessionId?: string | null;
  gameNumber?: number | null;
}

export interface GlobalSessionRecord {
  global_session_id: string;
  session_id1?: string | null;
  session_id2?: string | null;
  session_id3?: string | null;
  session_id4?: string | null;
  session_id5?: string | null;
}

export interface GlobalGameSessionContext {
  global_session_id: string;
  game_number: number;
  session_id: string;
}

interface LegacyApiResponse<T> {
  status: "success" | "error";
  data?: T;
  message?: string;
}

interface LegacySessionRecord {
  session_id: string;
  current_mode?: string | null;
  current_phase?: string | null;
  current_step?: number | string | null;
  whos_turn?: string | null;
  action_type?: string | null;
  blue_bans?: unknown;
  red_bans?: unknown;
  blue_picks?: unknown;
  red_picks?: unknown;
  system_banned_champions?: unknown;
  last_updated?: string | null;
}

interface SaveOptions {
  action?: string;
  userRole?: UserRole;
  expectedStep?: number;
}

const emptySessionState = createInitialSessionState("competitive");

export function useBpSession(options: UseBpSessionOptions = {}) {
  const [sessionId, setSessionId] = useState(options.sessionId ?? null);
  const [role, setRole] = useState<UserRole>(options.role ?? "host");
  const [globalSessionId, setGlobalSessionId] = useState(options.globalSessionId ?? null);
  const [gameNumber, setGameNumber] = useState(options.gameNumber ?? 0);
  const [state, setState] = useState<BpSessionState>(emptySessionState);
  const [pendingChampionId, setPendingChampionId] = useState<ChampionId | null>(null);
  const [previousGamesPicks, setPreviousGamesPicks] = useState<PreviousGamesPicks>({});
  const [isSessionActive, setIsSessionActive] = useState(Boolean(options.sessionId));
  const [isLoading, setIsLoading] = useState(Boolean(options.sessionId));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const completedNoticeRef = useRef<string | null>(null);

  const currentTurn = useMemo(() => getBpTurn(state.mode, state.currentStep), [state]);
  const canAct = canRoleActOnTurn(role, currentTurn);

  const saveSessionData = useCallback(
    async (nextState: BpSessionState, saveOptions: SaveOptions = {}) => {
      if (!sessionId) {
        return false;
      }

      const response = await postLegacy<{ session_id: string; message: string }>("updateSession", {
        ...toLegacySessionPayload(nextState, sessionId),
        global_session_id: globalSessionId,
        game_number: gameNumber || null,
        expected_current_step: saveOptions.expectedStep,
        user_role: saveOptions.userRole ?? role,
        action: saveOptions.action ?? nextState.actionType,
      });

      if (response.status === "error") {
        setError(response.message ?? "保存会话失败");
        return false;
      }

      return true;
    },
    [gameNumber, globalSessionId, role, sessionId],
  );

  const loadPreviousGamesData = useCallback(
    async (targetGlobalSessionId: string, maxGameNumber: number) => {
      if (maxGameNumber <= 0) {
        setPreviousGamesPicks({});
        return {};
      }

      const globalResponse = await getGlobalSession(targetGlobalSessionId);
      if (globalResponse.status === "error" || !globalResponse.data) {
        setPreviousGamesPicks({});
        return {};
      }

      const sessionRefs = Array.from({ length: maxGameNumber }, (_, index) => index + 1)
        .map((number) => ({
          gameNumber: number,
          sessionId: globalResponse.data?.[`session_id${number}` as keyof GlobalSessionRecord],
        }))
        .filter((item): item is { gameNumber: number; sessionId: string } =>
          Boolean(item.sessionId),
        );

      const records = await Promise.all(
        sessionRefs.map(async (item) => {
          const sessionResponse = await getSession(item.sessionId);
          if (sessionResponse.status === "success" && sessionResponse.data) {
            return {
              gameNumber: item.gameNumber,
              data: sessionResponse.data,
            };
          }
          return null;
        }),
      );

      const nextPreviousGames: PreviousGamesPicks = {};
      records.forEach((record) => {
        if (!record) {
          return;
        }

        nextPreviousGames[record.gameNumber] = {
          blue: decodeLegacyArray(record.data.blue_picks).filter(Boolean),
          red: decodeLegacyArray(record.data.red_picks).filter(Boolean),
        };
      });

      setPreviousGamesPicks(nextPreviousGames);
      return nextPreviousGames;
    },
    [],
  );

  const loadSession = useCallback(
    async (
      targetSessionId = sessionId,
      loadOptions: {
        targetRole?: UserRole;
        targetGlobalSessionId?: string | null;
        targetGameNumber?: number | null;
        silent?: boolean;
      } = {},
    ) => {
      if (!targetSessionId) {
        return false;
      }

      if (!loadOptions.silent) {
        setIsLoading(true);
      }

      try {
        const response = await getSession(targetSessionId);
        if (response.status === "error" || !response.data) {
          throw new Error(response.message ?? "会话不存在");
        }

        const nextRole = loadOptions.targetRole ?? role;
        const nextGlobalSessionId =
          loadOptions.targetGlobalSessionId === undefined
            ? globalSessionId
            : loadOptions.targetGlobalSessionId;
        const nextGameNumber =
          loadOptions.targetGameNumber === undefined ? gameNumber : (loadOptions.targetGameNumber ?? 0);

        let nextState = fromLegacySessionRecord(response.data);

        if (nextState.mode === "global" && nextGlobalSessionId && nextGameNumber > 1) {
          const previous = await loadPreviousGamesData(nextGlobalSessionId, nextGameNumber - 1);
          const previousBans = collectPreviousGameSystemBans(previous, nextGameNumber);
          nextState = {
            ...nextState,
            systemBannedChampions: uniqueChampionIds([
              ...previousBans,
              ...nextState.systemBannedChampions,
            ]),
          };
        }

        setSessionId(targetSessionId);
        setRole(nextRole);
        setGlobalSessionId(nextGlobalSessionId ?? null);
        setGameNumber(nextGameNumber);
        const syncedState = syncTurnFromStep(nextState);

        setState(syncedState);
        setPendingChampionId((currentPendingChampionId) => {
          if (!loadOptions.silent || !currentPendingChampionId) {
            return null;
          }

          const nextTurn = getBpTurn(syncedState.mode, syncedState.currentStep);
          if (
            !canRoleActOnTurn(nextRole, nextTurn) ||
            isChampionUnavailable(syncedState, currentPendingChampionId)
          ) {
            return null;
          }

          return currentPendingChampionId;
        });
        setIsSessionActive(true);
        setError(null);
        return true;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [gameNumber, globalSessionId, loadPreviousGamesData, role, sessionId],
  );

  useEffect(() => {
    if (!options.sessionId) {
      return;
    }

    const timer = setTimeout(() => {
      void loadSession(options.sessionId, {
        targetRole: options.role ?? "observer",
        targetGlobalSessionId: options.globalSessionId ?? null,
        targetGameNumber: options.gameNumber ?? 0,
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [loadSession, options.gameNumber, options.globalSessionId, options.role, options.sessionId]);

  useEffect(() => {
    if (!isSessionActive || !sessionId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled) {
        return;
      }

      await loadSession(sessionId, {
        targetRole: role,
        targetGlobalSessionId: globalSessionId,
        targetGameNumber: gameNumber,
        silent: true,
      });

      if (!cancelled) {
        timer = setTimeout(poll, 500);
      }
    }

    timer = setTimeout(poll, 500);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [gameNumber, globalSessionId, isSessionActive, loadSession, role, sessionId]);

  useEffect(() => {
    if (
      state.currentPhase !== "finished" ||
      state.mode !== "global" ||
      !globalSessionId ||
      !gameNumber ||
      !sessionId
    ) {
      return;
    }

    const completionKey = `${globalSessionId}:${gameNumber}:${sessionId}`;
    if (completedNoticeRef.current === completionKey) {
      return;
    }

    completedNoticeRef.current = completionKey;
    void updateGlobalSessionWithGameId(globalSessionId, gameNumber, sessionId).then((response) => {
      if (response.status === "success") {
        setNotice(`Game ${gameNumber} BP已完成！session ID: ${sessionId}`);
      }
    });
  }, [gameNumber, globalSessionId, sessionId, state.currentPhase, state.mode]);

  const startCompetitive = useCallback(async () => {
    const nextSessionId = generateSessionId();
    const nextState = createInitialSessionState("competitive");

    setSessionId(nextSessionId);
    setRole("host");
    setGlobalSessionId(null);
    setGameNumber(0);
    setState(nextState);
    setPendingChampionId(null);
    setIsSessionActive(true);

    const response = await postLegacy("createSession", toLegacySessionPayload(nextState, nextSessionId));
    if (response.status === "error") {
      setError(response.message ?? "创建会话失败");
      return null;
    }

    setError(null);
    return nextSessionId;
  }, []);

  const toggleSystemBan = useCallback(
    async (championId: ChampionId) => {
      if (role !== "referee") {
        return;
      }

      if (state.bluePicks.includes(championId) || state.redPicks.includes(championId)) {
        setNotice(`${championId} 已经被选择，无法系统禁用`);
        return;
      }

      const nextSystemBans = state.systemBannedChampions.includes(championId)
        ? state.systemBannedChampions.filter((id) => id !== championId)
        : [...state.systemBannedChampions, championId];
      const nextState = { ...state, systemBannedChampions: nextSystemBans };

      setState(nextState);
      const saved = await saveSessionData(nextState, {
        action: `system_ban_${championId}`,
        expectedStep: state.currentStep,
        userRole: "referee",
      });
      if (!saved) {
        await loadSession();
      }
    },
    [loadSession, role, saveSessionData, state],
  );

  const selectChampion = useCallback(
    async (championId: ChampionId) => {
      if (role === "referee") {
        await toggleSystemBan(championId);
        return;
      }

      if (!canAct || !state.whosTurn || !state.actionType) {
        return;
      }

      if (isChampionUnavailable(state, championId)) {
        return;
      }

      setPendingChampionId(championId);
    },
    [canAct, role, state, toggleSystemBan],
  );

  const confirmSelection = useCallback(async () => {
    if (!pendingChampionId || !canAct) {
      return;
    }

    const result = applyChampionSelection(state, pendingChampionId);
    if (!result.ok) {
      return;
    }

    setState(result.state);
    setPendingChampionId(null);
    const saved = await saveSessionData(result.state, {
      action: `${state.actionType}_${pendingChampionId}`,
      expectedStep: state.currentStep,
    });
    if (!saved) {
      await loadSession();
    }
  }, [canAct, loadSession, pendingChampionId, saveSessionData, state]);

  const emptyBan = useCallback(async () => {
    if (!canAct || state.actionType !== "ban") {
      return;
    }

    const result = applyEmptyBan(state, `EmptyBan_${Date.now()}`);
    if (!result.ok) {
      return;
    }

    setState(result.state);
    setPendingChampionId(null);
    const saved = await saveSessionData(result.state, {
      action: "empty_ban",
      expectedStep: state.currentStep,
    });
    if (!saved) {
      await loadSession();
    }
  }, [canAct, loadSession, saveSessionData, state]);

  const reset = useCallback(() => {
    setSessionId(null);
    setRole("host");
    setGlobalSessionId(null);
    setGameNumber(0);
    setState(emptySessionState);
    setPendingChampionId(null);
    setPreviousGamesPicks({});
    setIsSessionActive(false);
    setError(null);
    setNotice(null);
  }, []);

  return {
    sessionId,
    role,
    globalSessionId,
    gameNumber,
    state,
    currentTurn,
    pendingChampionId,
    previousGamesPicks,
    isSessionActive,
    isLoading,
    error,
    notice,
    canAct,
    setNotice,
    startCompetitive,
    selectChampion,
    confirmSelection,
    emptyBan,
    toggleSystemBan,
    loadSession,
    loadPreviousGamesData,
    reset,
  };
}

export async function createGlobalSessionWithGames() {
  const globalSessionId = `${generateSessionId()}_global`;
  const createResponse = await postLegacy("createGlobalSession", {
    global_session_id: globalSessionId,
  });

  if (createResponse.status === "error") {
    throw new Error(createResponse.message ?? "创建全局会话失败");
  }

  for (let gameNumber = 1; gameNumber <= 5; gameNumber += 1) {
    const sessionId = generateSessionId();
    const state = createGlobalGameSessionState(gameNumber, {});
    const sessionResponse = await postLegacy("createSession", {
      ...toLegacySessionPayload(state, sessionId),
      global_session_id: globalSessionId,
      game_number: gameNumber,
    });

    if (sessionResponse.status === "error") {
      throw new Error(sessionResponse.message ?? `创建 Game ${gameNumber} 会话失败`);
    }

    const updateResponse = await updateGlobalSessionWithGameId(globalSessionId, gameNumber, sessionId);
    if (updateResponse.status === "error") {
      throw new Error(updateResponse.message ?? `保存 Game ${gameNumber} 会话失败`);
    }
  }

  return getGlobalSessionRecord(globalSessionId);
}

export async function ensureGlobalGameSession(globalSessionId: string, gameNumber: number) {
  const globalResponse = await getGlobalSession(globalSessionId);
  if (globalResponse.status === "error" || !globalResponse.data) {
    throw new Error(globalResponse.message ?? "无法获取全局会话数据");
  }

  const sessionKey = `session_id${gameNumber}` as keyof GlobalSessionRecord;
  const existingSessionId = globalResponse.data[sessionKey];
  if (typeof existingSessionId === "string" && existingSessionId) {
    return existingSessionId;
  }

  const sessionId = generateSessionId();
  const previousGamesPicks = await loadPreviousGamesForGlobal(globalSessionId, gameNumber - 1);
  const state = createGlobalGameSessionState(gameNumber, previousGamesPicks);
  const sessionResponse = await postLegacy("createSession", {
    ...toLegacySessionPayload(state, sessionId),
    global_session_id: globalSessionId,
    game_number: gameNumber,
  });

  if (sessionResponse.status === "error") {
    throw new Error(sessionResponse.message ?? "创建游戏会话失败");
  }

  const updateResponse = await updateGlobalSessionWithGameId(globalSessionId, gameNumber, sessionId);
  if (updateResponse.status === "error") {
    throw new Error(updateResponse.message ?? "保存游戏会话失败");
  }

  return sessionId;
}

export async function getGlobalSessionRecord(globalSessionId: string) {
  const globalResponse = await getGlobalSession(globalSessionId);
  if (globalResponse.status === "error" || !globalResponse.data) {
    throw new Error(globalResponse.message ?? "无法获取全局会话数据");
  }

  return globalResponse.data;
}

export async function findGlobalSessionForGameSession(sessionId: string) {
  const response = await getLegacy<GlobalGameSessionContext>("getGlobalSessionForGameSession", {
    session_id: sessionId,
  });

  if (response.status === "success" && response.data) {
    return response.data;
  }

  return null;
}

export function buildRoleLinks(
  baseUrl: string,
  sessionId: string,
  options: { globalSessionId?: string | null; gameNumber?: number | null } = {},
) {
  const suffix =
    options.globalSessionId && options.gameNumber
      ? `&game=${options.gameNumber}&global_session=${options.globalSessionId}`
      : "";

  return {
    blue: `${baseUrl}?session=${sessionId}&role=blue${suffix}`,
    red: `${baseUrl}?session=${sessionId}&role=red${suffix}`,
    referee: `${baseUrl}?session=${sessionId}&role=referee${suffix}`,
    observer: `${baseUrl}?session=${sessionId}&role=observer${suffix}`,
  };
}

async function loadPreviousGamesForGlobal(globalSessionId: string, maxGameNumber: number) {
  const globalResponse = await getGlobalSession(globalSessionId);
  if (globalResponse.status === "error" || !globalResponse.data) {
    return {};
  }

  const previousGames: PreviousGamesPicks = {};
  for (let gameNumber = 1; gameNumber <= maxGameNumber; gameNumber += 1) {
    const sessionId = globalResponse.data[`session_id${gameNumber}` as keyof GlobalSessionRecord];
    if (typeof sessionId !== "string" || !sessionId) {
      continue;
    }

    const sessionResponse = await getSession(sessionId);
    if (sessionResponse.status === "success" && sessionResponse.data) {
      previousGames[gameNumber] = {
        blue: decodeLegacyArray(sessionResponse.data.blue_picks),
        red: decodeLegacyArray(sessionResponse.data.red_picks),
      };
    }
  }

  return previousGames;
}

async function getSession(sessionId: string) {
  return getLegacy<LegacySessionRecord>("getSession", { session_id: sessionId, _t: String(Date.now()) });
}

async function getGlobalSession(globalSessionId: string) {
  return getLegacy<GlobalSessionRecord>("getGlobalSession", { global_session_id: globalSessionId });
}

async function updateGlobalSessionWithGameId(
  globalSessionId: string,
  gameNumber: number,
  sessionId: string,
) {
  return postLegacy("updateGlobalSessionWithGameId", {
    global_session_id: globalSessionId,
    game_number: gameNumber,
    session_id: sessionId,
  });
}

async function getLegacy<T>(action: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ action, ...params });
  const response = await fetch(`${API_BASE_URL}?${searchParams.toString()}`);
  return (await response.json()) as LegacyApiResponse<T>;
}

async function postLegacy<T = unknown>(action: string, body: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}?action=${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return (await response.json()) as LegacyApiResponse<T>;
}

function fromLegacySessionRecord(record: LegacySessionRecord): BpSessionState {
  const mode = normalizeMode(record.current_mode);
  return syncTurnFromStep({
    mode,
    currentPhase: normalizePhase(record.current_phase),
    currentStep: Number(record.current_step ?? 0),
    whosTurn: record.whos_turn === "blue" || record.whos_turn === "red" ? record.whos_turn : "",
    actionType: record.action_type === "ban" || record.action_type === "pick" ? record.action_type : "",
    blueBans: decodeLegacyArray(record.blue_bans),
    redBans: decodeLegacyArray(record.red_bans),
    bluePicks: decodeLegacyArray(record.blue_picks),
    redPicks: decodeLegacyArray(record.red_picks),
    systemBannedChampions: decodeLegacyArray(record.system_banned_champions),
  });
}

function toLegacySessionPayload(state: BpSessionState, sessionId: string) {
  return {
    session_id: sessionId,
    current_mode: state.mode,
    current_phase: state.currentPhase,
    current_step: state.currentStep,
    whos_turn: state.whosTurn,
    action_type: state.actionType,
    blue_bans: state.blueBans,
    red_bans: state.redBans,
    blue_picks: state.bluePicks,
    red_picks: state.redPicks,
    system_banned_champions: state.systemBannedChampions,
  };
}

function decodeLegacyArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeMode(value: string | null | undefined): BpMode {
  if (value === "ranked" || value === "competitive" || value === "global") {
    return value;
  }

  return "competitive";
}

function normalizePhase(value: string | null | undefined): BpSessionState["currentPhase"] {
  if (
    value === "" ||
    value === "ban" ||
    value === "pick" ||
    value === "ban1" ||
    value === "pick1" ||
    value === "ban2" ||
    value === "pick2" ||
    value === "finished"
  ) {
    return value;
  }

  return "";
}

function uniqueChampionIds(championIds: string[]) {
  return Array.from(new Set(championIds.filter(Boolean)));
}

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

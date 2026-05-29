import { EMPTY_BAN_PREFIX } from "./types";
import type { BpAction, BpMode, BpSessionState, BpTurn, ChampionId, TeamSide } from "./types";

const COMPETITIVE_FLOW: readonly Omit<BpAction, "step">[] = [
  { side: "blue", actionType: "ban", phase: "ban1" },
  { side: "red", actionType: "ban", phase: "ban1" },
  { side: "blue", actionType: "ban", phase: "ban1" },
  { side: "red", actionType: "ban", phase: "ban1" },
  { side: "blue", actionType: "ban", phase: "ban1" },
  { side: "red", actionType: "ban", phase: "ban1" },
  { side: "blue", actionType: "pick", phase: "pick1" },
  { side: "red", actionType: "pick", phase: "pick1" },
  { side: "red", actionType: "pick", phase: "pick1" },
  { side: "blue", actionType: "pick", phase: "pick1" },
  { side: "blue", actionType: "pick", phase: "pick1" },
  { side: "red", actionType: "pick", phase: "pick1" },
  { side: "red", actionType: "ban", phase: "ban2" },
  { side: "blue", actionType: "ban", phase: "ban2" },
  { side: "red", actionType: "ban", phase: "ban2" },
  { side: "blue", actionType: "ban", phase: "ban2" },
  { side: "red", actionType: "pick", phase: "pick2" },
  { side: "blue", actionType: "pick", phase: "pick2" },
  { side: "blue", actionType: "pick", phase: "pick2" },
  { side: "red", actionType: "pick", phase: "pick2" },
] as const;

const RANKED_FLOW: readonly Omit<BpAction, "step">[] = [
  ...Array.from({ length: 5 }, () => ({ side: "blue", actionType: "ban", phase: "ban" }) as const),
  ...Array.from({ length: 5 }, () => ({ side: "red", actionType: "ban", phase: "ban" }) as const),
  { side: "blue", actionType: "pick", phase: "pick" },
  { side: "red", actionType: "pick", phase: "pick" },
  { side: "red", actionType: "pick", phase: "pick" },
  { side: "blue", actionType: "pick", phase: "pick" },
  { side: "blue", actionType: "pick", phase: "pick" },
  { side: "red", actionType: "pick", phase: "pick" },
  { side: "red", actionType: "pick", phase: "pick" },
  { side: "blue", actionType: "pick", phase: "pick" },
  { side: "blue", actionType: "pick", phase: "pick" },
  { side: "red", actionType: "pick", phase: "pick" },
] as const;

export function getBpTurn(mode: BpMode, step: number): BpTurn {
  const flow = mode === "ranked" ? RANKED_FLOW : COMPETITIVE_FLOW;
  const action = flow[step];

  if (!action) {
    return { step, side: "", actionType: "", phase: "finished" };
  }

  return { step, ...action };
}

export function getCompetitiveFlow(): BpAction[] {
  return COMPETITIVE_FLOW.map((action, step) => ({ step, ...action }));
}

export function isFinishedTurn(turn: BpTurn): turn is Extract<BpTurn, { phase: "finished" }> {
  return turn.phase === "finished";
}

export function isEmptyBan(championId: ChampionId): boolean {
  return championId.startsWith(EMPTY_BAN_PREFIX);
}

export function syncTurnFromStep(state: BpSessionState): BpSessionState {
  const turn = getBpTurn(state.mode, state.currentStep);

  return {
    ...state,
    currentPhase: turn.phase,
    whosTurn: turn.side,
    actionType: turn.actionType,
  };
}

export function advanceTurn(state: BpSessionState): BpSessionState {
  return syncTurnFromStep({ ...state, currentStep: state.currentStep + 1 });
}

export function applyChampionSelection(
  state: BpSessionState,
  championId: ChampionId,
): { ok: true; state: BpSessionState } | { ok: false; reason: string } {
  const current = syncTurnFromStep(state);

  if (!current.whosTurn || !current.actionType) {
    return { ok: false, reason: "bp_finished" };
  }

  if (isChampionUnavailable(current, championId)) {
    return { ok: false, reason: "champion_unavailable" };
  }

  const next = cloneState(current);
  const target = getSelectionBucket(next, current.whosTurn, current.actionType);
  target.push(championId);

  return { ok: true, state: advanceTurn(next) };
}

export function applyEmptyBan(
  state: BpSessionState,
  emptyBanId: ChampionId = `${EMPTY_BAN_PREFIX}${state.currentStep}`,
): { ok: true; state: BpSessionState } | { ok: false; reason: string } {
  const current = syncTurnFromStep(state);

  if (!current.whosTurn || current.actionType !== "ban") {
    return { ok: false, reason: "empty_ban_not_allowed" };
  }

  const next = cloneState(current);
  const target = current.whosTurn === "blue" ? next.blueBans : next.redBans;
  target.push(emptyBanId);

  return { ok: true, state: advanceTurn(next) };
}

export function isChampionUnavailable(state: BpSessionState, championId: ChampionId): boolean {
  if (isEmptyBan(championId)) {
    return false;
  }

  return [
    ...state.systemBannedChampions,
    ...state.blueBans.filter((id) => !isEmptyBan(id)),
    ...state.redBans.filter((id) => !isEmptyBan(id)),
    ...state.bluePicks,
    ...state.redPicks,
  ].includes(championId);
}

function getSelectionBucket(
  state: BpSessionState,
  side: TeamSide,
  actionType: "ban" | "pick",
): ChampionId[] {
  if (actionType === "ban") {
    return side === "blue" ? state.blueBans : state.redBans;
  }

  return side === "blue" ? state.bluePicks : state.redPicks;
}

function cloneState(state: BpSessionState): BpSessionState {
  return {
    ...state,
    blueBans: [...state.blueBans],
    redBans: [...state.redBans],
    bluePicks: [...state.bluePicks],
    redPicks: [...state.redPicks],
    systemBannedChampions: [...state.systemBannedChampions],
  };
}

import { getBpTurn, isEmptyBan, syncTurnFromStep } from "./bp-flow";
import type { BpMode, BpSessionState, ChampionId, PreviousGamesPicks } from "./types";

export function createInitialSessionState(
  mode: BpMode,
  options: { systemBannedChampions?: ChampionId[] } = {},
): BpSessionState {
  return syncTurnFromStep({
    mode,
    currentStep: 0,
    currentPhase: "",
    whosTurn: "",
    actionType: "",
    pendingChampionId: null,
    blueBans: [],
    redBans: [],
    bluePicks: [],
    redPicks: [],
    systemBannedChampions: [...(options.systemBannedChampions ?? [])],
  });
}

export function getUnavailableChampionIds(state: BpSessionState): ChampionId[] {
  return uniqueChampionIds([
    ...state.systemBannedChampions,
    ...state.blueBans.filter((id) => !isEmptyBan(id)),
    ...state.redBans.filter((id) => !isEmptyBan(id)),
    ...state.bluePicks,
    ...state.redPicks,
  ]);
}

export function collectPreviousGameSystemBans(
  previousGamesPicks: PreviousGamesPicks,
  currentGameNumber: number,
): ChampionId[] {
  const systemBans: ChampionId[] = [];

  for (let gameNumber = 1; gameNumber < currentGameNumber; gameNumber += 1) {
    const gamePicks = previousGamesPicks[gameNumber];

    if (Array.isArray(gamePicks)) {
      addChampionIds(systemBans, gamePicks);
      continue;
    }

    if (gamePicks) {
      addChampionIds(systemBans, gamePicks.blue ?? []);
      addChampionIds(systemBans, gamePicks.red ?? []);
    }
  }

  return systemBans;
}

export function createGlobalGameSessionState(
  gameNumber: number,
  previousGamesPicks: PreviousGamesPicks,
): BpSessionState {
  return createInitialSessionState("global", {
    systemBannedChampions: collectPreviousGameSystemBans(previousGamesPicks, gameNumber),
  });
}

export function isBpComplete(state: BpSessionState): boolean {
  return getBpTurn(state.mode, state.currentStep).phase === "finished";
}

function addChampionIds(target: ChampionId[], championIds: ChampionId[]): void {
  for (const championId of championIds) {
    if (championId && !isEmptyBan(championId) && !target.includes(championId)) {
      target.push(championId);
    }
  }
}

function uniqueChampionIds(championIds: ChampionId[]): ChampionId[] {
  const unique: ChampionId[] = [];
  addChampionIds(unique, championIds);
  return unique;
}

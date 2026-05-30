export const EMPTY_BAN_PREFIX = "EmptyBan_";

export type TeamSide = "blue" | "red";

export type BpMode = "ranked" | "competitive" | "global";

export type BpActionType = "ban" | "pick";

export type BpPhase = "" | "ban" | "pick" | "ban1" | "pick1" | "ban2" | "pick2" | "finished";

export type UserRole = "host" | "blue" | "red" | "observer" | "referee";

export type ChampionId = string;

export interface BpAction {
  step: number;
  side: TeamSide;
  actionType: BpActionType;
  phase: Exclude<BpPhase, "" | "finished">;
}

export interface FinishedBpAction {
  step: number;
  side: "";
  actionType: "";
  phase: "finished";
}

export type BpTurn = BpAction | FinishedBpAction;

export interface BpSessionState {
  mode: BpMode;
  currentStep: number;
  currentPhase: BpPhase;
  whosTurn: TeamSide | "";
  actionType: BpActionType | "";
  pendingChampionId: ChampionId | null;
  blueBans: ChampionId[];
  redBans: ChampionId[];
  bluePicks: ChampionId[];
  redPicks: ChampionId[];
  systemBannedChampions: ChampionId[];
}

export interface PreviousGamePicks {
  blue?: ChampionId[];
  red?: ChampionId[];
}

export type PreviousGamesPicks = Record<number, PreviousGamePicks | ChampionId[] | undefined>;

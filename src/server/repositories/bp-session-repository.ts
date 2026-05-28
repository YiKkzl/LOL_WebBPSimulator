import type { BpSession, PrismaClient } from "@prisma/client";

import { db } from "@/src/server/db";

type JsonStringArrayValue = string | string[] | null | undefined;

export interface LegacyBpSessionRecord {
  session_id: string;
  current_mode: string | null;
  current_phase: string | null;
  current_step: number | null;
  whos_turn: string | null;
  action_type: string | null;
  blue_bans: string | null;
  red_bans: string | null;
  blue_picks: string | null;
  red_picks: string | null;
  system_banned_champions: string | null;
  last_updated: Date;
}

export interface CreateBpSessionInput {
  session_id: string;
  current_mode: string;
  current_phase?: string;
  current_step?: number;
  whos_turn?: string;
  action_type?: string;
  blue_bans?: JsonStringArrayValue;
  red_bans?: JsonStringArrayValue;
  blue_picks?: JsonStringArrayValue;
  red_picks?: JsonStringArrayValue;
  system_banned_champions?: JsonStringArrayValue;
}

export interface UpdateBpSessionInput extends Partial<Omit<CreateBpSessionInput, "session_id">> {
  session_id: string;
}

export async function findBpSessionById(
  sessionId: string,
  client: PrismaClient = db,
): Promise<LegacyBpSessionRecord | null> {
  const session = await client.bpSession.findUnique({
    where: { sessionId },
  });

  return session ? toLegacyBpSessionRecord(session) : null;
}

export async function createBpSession(
  input: CreateBpSessionInput,
  client: PrismaClient = db,
): Promise<LegacyBpSessionRecord> {
  const session = await client.bpSession.create({
    data: {
      sessionId: input.session_id,
      currentMode: input.current_mode,
      currentPhase: input.current_phase ?? "",
      currentStep: input.current_step ?? 0,
      whosTurn: input.whos_turn ?? "",
      actionType: input.action_type ?? "",
      blueBans: encodeLegacyJsonArray(input.blue_bans),
      redBans: encodeLegacyJsonArray(input.red_bans),
      bluePicks: encodeLegacyJsonArray(input.blue_picks),
      redPicks: encodeLegacyJsonArray(input.red_picks),
      systemBannedChampions: encodeLegacyJsonArray(input.system_banned_champions),
    },
  });

  return toLegacyBpSessionRecord(session);
}

export async function updateBpSession(
  input: UpdateBpSessionInput,
  client: PrismaClient = db,
): Promise<LegacyBpSessionRecord> {
  const session = await client.bpSession.update({
    where: { sessionId: input.session_id },
    data: {
      currentMode: input.current_mode ?? "",
      currentPhase: input.current_phase ?? "",
      currentStep: input.current_step ?? 0,
      whosTurn: input.whos_turn ?? "",
      actionType: input.action_type ?? "",
      blueBans: encodeLegacyJsonArray(input.blue_bans),
      redBans: encodeLegacyJsonArray(input.red_bans),
      bluePicks: encodeLegacyJsonArray(input.blue_picks),
      redPicks: encodeLegacyJsonArray(input.red_picks),
      systemBannedChampions: encodeLegacyJsonArray(input.system_banned_champions),
    },
  });

  return toLegacyBpSessionRecord(session);
}

export function toLegacyBpSessionRecord(session: BpSession): LegacyBpSessionRecord {
  return {
    session_id: session.sessionId,
    current_mode: session.currentMode,
    current_phase: session.currentPhase,
    current_step: session.currentStep,
    whos_turn: session.whosTurn,
    action_type: session.actionType,
    blue_bans: session.blueBans,
    red_bans: session.redBans,
    blue_picks: session.bluePicks,
    red_picks: session.redPicks,
    system_banned_champions: session.systemBannedChampions,
    last_updated: session.lastUpdated,
  };
}

function encodeLegacyJsonArray(value: JsonStringArrayValue): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value ?? []);
}

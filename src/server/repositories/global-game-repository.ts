import type { GlobalGame, Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/src/server/db";

export type GlobalGameNumber = 1 | 2 | 3 | 4 | 5;

type SessionIdField = "sessionId1" | "sessionId2" | "sessionId3" | "sessionId4" | "sessionId5";

export interface LegacyGlobalGameRecord {
  id: number;
  global_session_id: string;
  session_id1: string | null;
  session_id2: string | null;
  session_id3: string | null;
  session_id4: string | null;
  session_id5: string | null;
  created_at: Date | null;
  updated_at: Date;
}

export interface LegacyGlobalGameSessionReference extends LegacyGlobalGameRecord {
  game_number: GlobalGameNumber;
  session_id: string;
}

export async function findGlobalGameByGlobalSessionId(
  globalSessionId: string,
  client: PrismaClient = db,
): Promise<LegacyGlobalGameRecord | null> {
  const globalGame = await client.globalGame.findUnique({
    where: { globalSessionId },
  });

  return globalGame ? toLegacyGlobalGameRecord(globalGame) : null;
}

export async function findGlobalGameByGameSessionId(
  sessionId: string,
  client: PrismaClient = db,
): Promise<LegacyGlobalGameSessionReference | null> {
  const globalGame = await client.globalGame.findFirst({
    where: {
      OR: [
        { sessionId1: sessionId },
        { sessionId2: sessionId },
        { sessionId3: sessionId },
        { sessionId4: sessionId },
        { sessionId5: sessionId },
      ],
    },
  });

  if (!globalGame) {
    return null;
  }

  const record = toLegacyGlobalGameRecord(globalGame);
  const gameNumber = getGameNumberForSessionId(record, sessionId);
  if (!gameNumber) {
    return null;
  }

  return {
    ...record,
    game_number: gameNumber,
    session_id: sessionId,
  };
}

export async function createGlobalGame(
  globalSessionId: string,
  client: PrismaClient = db,
): Promise<LegacyGlobalGameRecord> {
  const globalGame = await client.globalGame.create({
    data: {
      globalSessionId,
      createdAt: new Date(),
    },
  });

  return toLegacyGlobalGameRecord(globalGame);
}

export async function updateGlobalGameSessionId(
  globalSessionId: string,
  gameNumber: GlobalGameNumber,
  sessionId: string,
  client: PrismaClient = db,
): Promise<LegacyGlobalGameRecord> {
  const field = getSessionIdField(gameNumber);
  const data: Prisma.GlobalGameUpdateInput = {
    [field]: sessionId,
  };

  const globalGame = await client.globalGame.update({
    where: { globalSessionId },
    data,
  });

  return toLegacyGlobalGameRecord(globalGame);
}

export function toLegacyGlobalGameRecord(globalGame: GlobalGame): LegacyGlobalGameRecord {
  return {
    id: globalGame.id,
    global_session_id: globalGame.globalSessionId,
    session_id1: globalGame.sessionId1,
    session_id2: globalGame.sessionId2,
    session_id3: globalGame.sessionId3,
    session_id4: globalGame.sessionId4,
    session_id5: globalGame.sessionId5,
    created_at: globalGame.createdAt,
    updated_at: globalGame.updatedAt,
  };
}

function getSessionIdField(gameNumber: GlobalGameNumber): SessionIdField {
  return `sessionId${gameNumber}` as SessionIdField;
}

function getGameNumberForSessionId(
  record: LegacyGlobalGameRecord,
  sessionId: string,
): GlobalGameNumber | null {
  for (const gameNumber of [1, 2, 3, 4, 5] as const) {
    if (record[`session_id${gameNumber}`] === sessionId) {
      return gameNumber;
    }
  }

  return null;
}

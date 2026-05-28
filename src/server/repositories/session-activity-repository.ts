import type { PrismaClient, SessionActivity } from "@prisma/client";

import { db } from "@/src/server/db";

export interface LegacySessionActivityRecord {
  id: number;
  session_id: string | null;
  action: string | null;
  action_by: string | null;
  action_data: string | null;
  created_at: Date;
}

export interface CreateSessionActivityInput {
  session_id: string;
  action?: string;
  action_by?: string;
  action_data?: string;
}

export async function createSessionActivity(
  input: CreateSessionActivityInput,
  client: PrismaClient = db,
): Promise<LegacySessionActivityRecord> {
  const activity = await client.sessionActivity.create({
    data: {
      sessionId: input.session_id,
      action: input.action ?? "update",
      actionBy: input.action_by ?? "unknown",
      actionData: input.action_data ?? null,
    },
  });

  return toLegacySessionActivityRecord(activity);
}

export async function findSessionActivityBySessionId(
  sessionId: string,
  client: PrismaClient = db,
): Promise<LegacySessionActivityRecord[]> {
  const activity = await client.sessionActivity.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return activity.map(toLegacySessionActivityRecord);
}

export function toLegacySessionActivityRecord(
  activity: SessionActivity,
): LegacySessionActivityRecord {
  return {
    id: activity.id,
    session_id: activity.sessionId,
    action: activity.action,
    action_by: activity.actionBy,
    action_data: activity.actionData,
    created_at: activity.createdAt,
  };
}

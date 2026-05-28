import { expect, test, type APIRequestContext } from "@playwright/test";

test("legacy api supports session and global session contracts", async ({ request }) => {
  const sessionId = uniqueId("api");
  const globalSessionId = `${uniqueId("g")}_global`;

  await expectLegacySuccess(
    request.post("/api.php?action=createSession", {
      data: sessionPayload(sessionId),
    }),
  );

  const createdSession = await legacyJson(
    request.get(`/api.php?action=getSession&session_id=${sessionId}`),
  );
  expect(createdSession).toMatchObject({
    status: "success",
    data: {
      session_id: sessionId,
      current_mode: "competitive",
      whos_turn: "blue",
      action_type: "ban",
      blue_bans: [],
      red_bans: [],
    },
  });

  await expectLegacySuccess(
    request.post("/api.php?action=updateSession", {
      data: sessionPayload(sessionId, {
        current_step: 1,
        whos_turn: "red",
        blue_bans: ["Aatrox"],
        action: "ban_Aatrox",
        user_role: "blue",
      }),
    }),
  );

  const updatedSession = await legacyJson(
    request.get(`/api.php?action=getSession&session_id=${sessionId}`),
  );
  expect(updatedSession).toMatchObject({
    status: "success",
    data: {
      session_id: sessionId,
      current_step: 1,
      whos_turn: "red",
      blue_bans: ["Aatrox"],
    },
  });

  await expectLegacySuccess(
    request.post("/api.php?action=createGlobalSession", {
      data: {
        global_session_id: globalSessionId,
      },
    }),
  );

  await expectLegacySuccess(
    request.post("/api.php?action=updateGlobalSessionWithGameId", {
      data: {
        global_session_id: globalSessionId,
        game_number: 1,
        session_id: sessionId,
      },
    }),
  );

  const globalSession = await legacyJson(
    request.get(`/api.php?action=getGlobalSession&global_session_id=${globalSessionId}`),
  );
  expect(globalSession).toMatchObject({
    status: "success",
    data: {
      global_session_id: globalSessionId,
      session_id1: sessionId,
    },
  });

  const missing = await legacyJson(request.get("/api.php?action=getSession&session_id=missing_e2e"));
  expect(missing).toMatchObject({
    status: "error",
    message: "会话不存在",
  });
});

async function expectLegacySuccess(responsePromise: Promise<{ json: () => Promise<unknown>; ok: () => boolean }>) {
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "success" });
}

async function legacyJson(responsePromise: ReturnType<APIRequestContext["get"]>) {
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  return response.json();
}

function sessionPayload(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    current_mode: "competitive",
    current_phase: "ban1",
    current_step: 0,
    whos_turn: "blue",
    action_type: "ban",
    blue_bans: [],
    red_bans: [],
    blue_picks: [],
    red_picks: [],
    system_banned_champions: [],
    ...overrides,
  };
}

function uniqueId(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

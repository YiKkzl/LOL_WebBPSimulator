import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const champions = [
  champion("Ashe", "寒冰射手", "艾希", "Marksman"),
  champion("Garen", "德玛西亚之力", "盖伦", "Fighter"),
  champion("Lux", "光辉女郎", "拉克丝", "Mage"),
  champion("Ahri", "九尾妖狐", "狐狸", "Mage"),
];

test("global BP start creates five game ids and distribution return keeps the global session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "全局 BP 模式" }).click();

  await expect(page.locator("#game-selection")).toBeVisible();
  await expect(page.locator(".game-buttons").getByRole("button")).toHaveCount(5);
  await expect(page.locator(".game-session-item .session-id")).toHaveCount(5);

  const gameOneId = await page
    .locator(".game-session-item")
    .filter({ hasText: "Game 1" })
    .locator(".session-id")
    .textContent();
  expect(gameOneId?.trim()).toBeTruthy();

  await page.locator(".game-buttons").getByRole("button", { name: "Game 1" }).click();
  await expect(page.locator(".distribute-header")).toContainText("Game 1");

  await page.locator(".distribute-buttons").getByRole("button", { name: "返回" }).click();
  await expect(page.locator("#game-selection")).toBeVisible();
  await expect(page.locator("#global-session-info")).toContainText(gameOneId?.trim() ?? "");
});

test("global BP distributes game links and auto-bans previous game picks", async ({
  context,
  page,
  request,
}) => {
  const globalSessionId = `${uniqueId("gbp")}_global`;
  const gameOneSessionId = uniqueId("g1");
  const gameTwoSessionId = uniqueId("g2");

  await createGlobalSession(request, globalSessionId);
  await createSession(request, gameOneSessionId, {
    current_mode: "global",
    current_step: 8,
    whos_turn: "red",
    action_type: "pick",
    blue_picks: ["Garen"],
    red_picks: ["Ashe"],
  });
  await createSession(request, gameTwoSessionId, {
    current_mode: "global",
  });
  await setGlobalGame(request, globalSessionId, 1, gameOneSessionId);
  await setGlobalGame(request, globalSessionId, 2, gameTwoSessionId);

  await mockDataDragon(context);

  for (const gameNumber of [1, 2, 3, 4, 5]) {
    await page.goto(`/?mode=distribute&game=${gameNumber}&global_session=${globalSessionId}`);
    await expect(page.locator(".distribute-header")).toContainText(`Game ${gameNumber}`);
    await expect(page.locator(".role-link-box")).toHaveCount(4);
  }

  await page.goto(`/?mode=distribute&game=2&global_session=${globalSessionId}`);
  const blueUrl = await roleLink(page, "蓝方链接");
  expect(blueUrl).toContain(`game=2`);
  expect(blueUrl).toContain(`global_session=${globalSessionId}`);

  await page.goto(blueUrl);
  await expect(page.locator("#mode-title")).toHaveText("全局BP模式 - Game 2");
  await expect(page.locator("#share-links")).toHaveCount(0);
  await expect(page.locator("#previous-games-info")).toContainText("前面对局已选英雄");
  await expect(page.locator('#system-banned-champions [data-id="Garen"]')).toBeVisible();
  await expect(page.locator('#system-banned-champions [data-id="Ashe"]')).toBeVisible();

  await page.locator('[data-id="Garen"]').first().click();
  await expect(page.locator("#pending-champion")).toHaveText("无");
});

async function createGlobalSession(request: APIRequestContext, globalSessionId: string) {
  const response = await request.post("/api.php?action=createGlobalSession", {
    data: { global_session_id: globalSessionId },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "success" });
}

async function createSession(
  request: APIRequestContext,
  sessionId: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await request.post("/api.php?action=createSession", {
    data: {
      session_id: sessionId,
      current_mode: "competitive",
      current_phase: "ban1",
      current_step: 0,
      whos_turn: "blue",
      action_type: "ban",
      pending_champion_id: null,
      blue_bans: [],
      red_bans: [],
      blue_picks: [],
      red_picks: [],
      system_banned_champions: [],
      ...overrides,
    },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "success" });
}

async function setGlobalGame(
  request: APIRequestContext,
  globalSessionId: string,
  gameNumber: number,
  sessionId: string,
) {
  const response = await request.post("/api.php?action=updateGlobalSessionWithGameId", {
    data: {
      global_session_id: globalSessionId,
      game_number: gameNumber,
      session_id: sessionId,
    },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "success" });
}

async function mockDataDragon(context: BrowserContext) {
  await context.route("https://ddragon.leagueoflegends.com/api/versions.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(["14.1.1"]) });
  });
  await context.route("https://ddragon.leagueoflegends.com/cdn/14.1.1/data/zh_CN/champion.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: Object.fromEntries(champions.map((item) => [item.id, item])) }),
    });
  });
  await context.route(/https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[^/]+\/img\/champion\/.+\.png/, async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(tinyPng, "base64") });
  });
}

async function roleLink(page: Page, label: string) {
  return page.locator(".role-link-box").filter({ hasText: label }).locator("input").inputValue();
}

function champion(id: string, name: string, title: string, tag: string) {
  return {
    id,
    name,
    title,
    key: id,
    tags: [tag],
  };
}

function uniqueId(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

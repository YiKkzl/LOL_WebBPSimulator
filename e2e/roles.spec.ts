import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const champions = [
  champion("Aatrox", "暗裔剑魔", "剑魔", "Fighter"),
  champion("Ahri", "九尾妖狐", "狐狸", "Mage"),
];

test("observer is read-only and referee can system ban or unban champions", async ({
  browser,
  context,
  page,
  request,
}) => {
  const sessionId = uniqueId("role");
  await createSession(request, sessionId);
  await mockDataDragon(context);

  await page.goto(`/?session=${sessionId}&role=observer`);
  await expect(page.locator("#observer-notice")).toContainText("观战模式");
  await expect(page.locator("#share-links")).toHaveCount(0);
  await expect(page.locator("#observer-draft-display")).toBeVisible();
  await expect(page.locator("#champion-pool")).toHaveCount(0);
  await expect(page.locator("#pending-champion")).toHaveText("无");
  await expect(page.locator("#confirm-button")).toHaveCount(0);
  await expect(page.locator("#empty-ban-button")).toHaveCount(0);
  await page.locator("#reset-button").click();
  await expect(page.locator("#mode-selection")).toBeVisible();

  const refereePage = await browser.newPage();
  await mockDataDragon(refereePage.context());
  await refereePage.goto(`/?session=${sessionId}&role=referee`);
  await expect(refereePage.locator("#referee-notice")).toContainText("裁判模式");
  await expect(refereePage.locator("#share-links")).toHaveCount(0);
  await refereePage.locator('#champion-pool [data-id="Aatrox"]').click();
  await expect(refereePage.locator('#system-banned-champions [data-id="Aatrox"]')).toBeVisible();

  const bluePage = await browser.newPage();
  await mockDataDragon(bluePage.context());
  await bluePage.goto(`/?session=${sessionId}&role=blue`);
  await expect(bluePage.locator("#share-links")).toHaveCount(0);
  await expect(bluePage.locator('#champion-pool [data-id="Aatrox"]')).toHaveClass(/system-banned/);
  await bluePage.locator('#champion-pool [data-id="Aatrox"]').click();
  await expect(bluePage.locator("#pending-champion")).toHaveText("无");

  await refereePage.locator('#system-banned-champions [data-id="Aatrox"]').click();
  await expect(refereePage.locator('#system-banned-champions [data-id="Aatrox"]')).toHaveCount(0);
  await expect.poll(() => championClasses(bluePage, "Aatrox")).not.toContain("system-banned");
  await refereePage.locator("#reset-button").click();
  await expect(refereePage.locator("#mode-selection")).toBeVisible();
});

async function createSession(request: APIRequestContext, sessionId: string) {
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

async function championClasses(page: Page, championId: string) {
  return page.locator(`#champion-pool [data-id="${championId}"]`).getAttribute("class");
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

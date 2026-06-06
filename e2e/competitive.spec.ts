import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const champions = [
  champion("Aatrox", "暗裔剑魔", "剑魔", "Fighter"),
  champion("Ahri", "九尾妖狐", "狐狸", "Mage"),
  champion("Akali", "离群之刺", "阿卡丽", "Assassin"),
  champion("Annie", "黑暗之女", "安妮", "Mage"),
  champion("Ashe", "寒冰射手", "艾希", "Marksman"),
  champion("Garen", "德玛西亚之力", "盖伦", "Fighter"),
  champion("Darius", "诺克萨斯之手", "德莱厄斯", "Fighter"),
  champion("Lux", "光辉女郎", "拉克丝", "Mage"),
];

test("competitive BP supports shared role links, empty ban, bans, and picks", async ({
  browser,
  context,
  page,
}) => {
  await mockDataDragon(context);

  await page.goto("/");
  await page.getByRole("button", { name: "竞技征召 BP" }).click();
  await expect(page.locator("#mode-title")).toHaveText("竞技征召 BP");
  await expect(page.locator("#share-links")).toContainText("蓝方队长链接");

  const blueUrl = await roleLink(page, "蓝方队长链接");
  const redUrl = await roleLink(page, "红方队长链接");
  const observerUrl = await roleLink(page, "观战链接");

  const bluePage = await browser.newPage();
  const redPage = await browser.newPage();
  const observerPage = await browser.newPage();
  await Promise.all([mockDataDragon(bluePage.context()), mockDataDragon(redPage.context()), mockDataDragon(observerPage.context())]);

  await bluePage.goto(blueUrl);
  await redPage.goto(redUrl);
  await observerPage.goto(observerUrl);

  await expect(bluePage.locator("#share-links")).toHaveCount(0);
  await expect(redPage.locator("#share-links")).toHaveCount(0);
  await expect(observerPage.locator("#share-links")).toHaveCount(0);

  await waitAction(bluePage, "蓝方 禁用 B1");
  await expect(redPage.locator("#confirm-button")).toBeDisabled();
  await expect(observerPage.locator("#observer-notice")).toContainText("观战模式");
  await expect(observerPage.locator("#observer-draft-display")).toBeVisible();
  await expect(observerPage.locator("#champion-pool")).toHaveCount(0);
  await expect(observerPage.locator("#confirm-button")).toHaveCount(0);
  await expect(observerPage.locator("#empty-ban-button")).toHaveCount(0);
  await expect(observerPage.locator(".team-panel")).toHaveCount(0);
  await expect(observerPage.locator("#observer-draft-display h3, #observer-draft-display h4")).toHaveCount(0);
  await expect(observerPage.locator("#observer-draft-display .observer-banner-group h4")).toHaveCount(0);
  await expect(observerPage.locator("#observer-draft-display [data-pick-slot]")).toHaveCount(10);
  await expect(observerPage.locator("#observer-ban-strip")).toBeVisible();
  await expect(observerPage.locator("#observer-ban-strip [data-observer-ban-slot]")).toHaveCount(10);
  await expect(observerPage.locator("#observer-ban-strip .observer-ban-side.blue [data-observer-ban-slot]")).toHaveCount(5);
  await expect(observerPage.locator("#observer-ban-strip .observer-ban-side.red [data-observer-ban-slot]")).toHaveCount(5);

  await bluePage.locator("#empty-ban-button").click();
  await waitAction(redPage, "红方 禁用 B1");
  await expect(observerPage.locator('#observer-ban-strip [data-empty-ban="true"]')).toBeVisible();

  await redPage.locator('#champion-pool [data-id="Aatrox"]').click();
  await expect(redPage.locator("#confirm-button")).toBeEnabled();
  await expect(observerPage.locator("#pending-champion")).toContainText("暗裔剑魔");
  await expect(bluePage.locator("#pending-champion")).toContainText("暗裔剑魔");
  await redPage.locator("#confirm-button").click();
  await expect(observerPage.locator("#pending-champion")).toHaveText("无");
  await expect(observerPage.locator('#observer-draft-display [data-action-type="ban"]')).toHaveCount(0);
  await expect(observerPage.locator('#observer-draft-display [data-champion-id="Aatrox"]')).toHaveCount(0);
  await expect(observerPage.locator('#observer-ban-strip [data-action-type="ban"]')).toHaveCount(2);
  await expect(observerPage.locator('#observer-ban-strip [data-champion-id="Aatrox"]')).toBeVisible();
  await expect(observerPage.locator('#observer-ban-strip [data-champion-id="Aatrox"] img')).toBeVisible();
  await expect(observerPage.locator('#observer-ban-strip [data-champion-id="Aatrox"] span')).toHaveCount(0);
  await waitAction(bluePage, "蓝方 禁用 B2");

  await selectAndConfirm(bluePage, "Ahri");
  await waitAction(redPage, "红方 禁用 B2");

  await selectAndConfirm(redPage, "Akali");
  await waitAction(bluePage, "蓝方 禁用 B3");

  await selectAndConfirm(bluePage, "Annie");
  await waitAction(redPage, "红方 禁用 B3");

  await selectAndConfirm(redPage, "Ashe");
  await waitAction(bluePage, "蓝方 选用 P1");

  await selectAndConfirm(bluePage, "Garen");
  await waitAction(redPage, "红方 选用 P1");
  await expect(observerPage.locator('[data-action-type="pick"][data-champion-id="Garen"]')).toBeVisible();
  await expect(
    observerPage.locator('[data-action-type="pick"][data-champion-id="Garen"] .observer-banner-art'),
  ).toHaveAttribute("src", /\/cdn\/img\/champion\/loading\/Garen_0\.jpg$/);
  await expect(observerPage.locator("#observer-draft-display [data-pick-slot]")).toHaveCount(9);
  await expect
    .poll(async () => (await observerPage.locator('[data-action-type="pick"][data-champion-id="Garen"]').boundingBox())?.height)
    .toBeGreaterThanOrEqual(86);
  const lateObserverPage = await browser.newPage();
  await mockDataDragon(lateObserverPage.context());
  await lateObserverPage.goto(observerUrl);
  await expect(lateObserverPage.locator('[data-action-type="pick"][data-champion-id="Garen"]')).toBeVisible();
  await expect(
    lateObserverPage.locator('[data-action-type="pick"][data-champion-id="Garen"]'),
  ).toHaveCSS("animation-name", "observer-banner-reveal");
  await expect(lateObserverPage.locator('#observer-draft-display [data-action-type="ban"]')).toHaveCount(0);
  await expect(lateObserverPage.locator('#observer-ban-strip [data-action-type="ban"]')).toHaveCount(6);
  await lateObserverPage.close();

  await selectAndConfirm(redPage, "Darius");
  await waitAction(bluePage, "红方 选用 P2");

  await expect(bluePage.locator(".blue-team .picks [data-champion-name='德玛西亚之力']")).toBeVisible();
  await expect(redPage.locator(".red-team .picks [data-champion-name='诺克萨斯之手']")).toBeVisible();
  await expect(observerPage.locator("#current-action")).toContainText("红方 选用 P2");
});

async function mockDataDragon(context: BrowserContext) {
  await context.route("https://ddragon.leagueoflegends.com/api/versions.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(["14.1.1"]),
    });
  });
  await context.route("https://ddragon.leagueoflegends.com/cdn/14.1.1/data/zh_CN/champion.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: Object.fromEntries(champions.map((item) => [item.id, item])),
      }),
    });
  });
  await context.route(/https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[^/]+\/img\/champion\/.+\.png/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(tinyPng, "base64"),
    });
  });
  await context.route(/https:\/\/ddragon\.leagueoflegends\.com\/cdn\/img\/champion\/loading\/.+\.jpg/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(tinyPng, "base64"),
    });
  });
}

async function roleLink(page: Page, label: string) {
  return page.locator(".share-link").filter({ hasText: label }).locator("input").inputValue();
}

async function waitAction(page: Page, text: string) {
  await expect(page.locator("#current-action")).toContainText(text);
}

async function selectAndConfirm(page: Page, championId: string) {
  await page.locator(`#champion-pool [data-id="${championId}"]`).click();
  await expect(page.locator("#confirm-button")).toBeEnabled();
  await page.waitForTimeout(650);
  await expect(page.locator("#confirm-button")).toBeEnabled();
  await page.locator("#confirm-button").click();
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

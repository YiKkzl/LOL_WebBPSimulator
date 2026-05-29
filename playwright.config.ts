import { defineConfig, devices } from "@playwright/test";

const defaultDatabaseUrl = "mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test";
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

if (!/^mysql:\/\/[^@]+@(?:127\.0\.0\.1|localhost):3307\/lolbp_test(?:[?].*)?$/.test(databaseUrl)) {
  throw new Error("E2E tests must use the local Docker MySQL database on 127.0.0.1:3307/lolbp_test.");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://127.0.0.1:3100",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: databaseUrl,
    },
  },
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/personas",
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  retries: 0,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
      args: ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    }
  },
  webServer: {
    command: "node tests/helpers/static-server.mjs 4173",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});

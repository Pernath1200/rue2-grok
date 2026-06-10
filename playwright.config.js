const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5555',
    headless: true,
    // Keep tests deterministic: no SW caching between runs, and page.route()
    // can intercept JSON fetches (the SW would otherwise bypass it).
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node server.js',
    port: 5555,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});

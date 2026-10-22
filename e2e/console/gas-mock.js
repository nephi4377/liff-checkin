const path = require('path');
const fs = require('fs');

/** Per-test flags; read inside the route handler (mutate before page.goto). */
const mockOptions = {};

function loadFixture(name) {
  const file = path.join(__dirname, 'fixtures', name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resetMockOptions() {
  Object.keys(mockOptions).forEach((key) => {
    delete mockOptions[key];
  });
}

/**
 * Intercept all Google Apps Script calls used by the hub SPA and project console.
 * @param {import('@playwright/test').Page} page
 */
async function installConsoleGasMocks(page) {
  const fixtures = {
    hubCore: loadFixture('hub-core.json'),
    hubProjects: loadFixture('hub-projects.json'),
    hubSchedule: loadFixture('hub-schedule.json'),
    hubPresence: loadFixture('hub-presence.json'),
    hubDailyReports: loadFixture('hub-daily-reports.json'),
    employees: loadFixture('console-employees.json'),
    projectDetail: loadFixture('project-detail.json'),
  };

  await page.route(/https:\/\/script\.google\.com\/macros\/.*/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'POST') {
      let body = {};
      try {
        body = JSON.parse(request.postData() || '{}');
      } catch {
        body = {};
      }
      if (body.action === 'vendor_payment_list') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, items: [] }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }

    const pageParam = url.searchParams.get('page');
    const action = url.searchParams.get('action');

    if (pageParam === 'attendance_api') {
      if (action === 'get_hub_core_data') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.hubCore),
        });
      }
      if (action === 'get_latest_schedule') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.hubSchedule),
        });
      }
      if (action === 'get_hub_today_presence') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.hubPresence),
        });
      }
      if (action === 'get_employees') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fixtures.employees),
        });
      }
    }

    if (pageParam === 'get_hub_projects_data') {
      if (mockOptions.failHubProjects) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'E2E mock：專案清單失敗' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.hubProjects),
      });
    }

    if (pageParam === 'get_daily_reports') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.hubDailyReports),
      });
    }

    if (pageParam === 'project') {
      if (mockOptions.failProjectDetail) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'E2E mock：案場資料失敗',
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fixtures.projectDetail),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

/** Stub LIFF so accidental non-localhost runs do not redirect to LINE Login. */
async function installLiffStub(page) {
  await page.addInitScript(() => {
    window.liff = {
      init: async () => {},
      isLoggedIn: () => true,
      isInClient: () => false,
      login: () => {},
      logout: () => {},
      getProfile: async () => ({
        userId: 'Ud58333430513b7527106fa71d2e30151',
        displayName: 'E2E 測試員',
      }),
      getIDToken: () => 'e2e-mock-liff-id-token',
    };
  });
}

async function clearHubStorage(page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

async function prepareConsolePage(page) {
  resetMockOptions();
  await clearHubStorage(page);
  await installLiffStub(page);
  await installConsoleGasMocks(page);
}

module.exports = {
  mockOptions,
  resetMockOptions,
  installConsoleGasMocks,
  installLiffStub,
  clearHubStorage,
  prepareConsolePage,
};

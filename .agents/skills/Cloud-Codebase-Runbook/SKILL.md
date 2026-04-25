# Skill: Cloud agent — run & test this repo

Use this when you need to **run pages locally**, **log in or fake identity**, **hit APIs**, or **run automated tests**. Paths are from repo root `/workspace` unless noted.

---

## Global prerequisites

- **Node.js** (for tests and static servers). `npm` comes with it.
- **Browser**: many flows need **LINE LIFF**（在 LINE 裡開網頁並辨識使用者） outside localhost; on **localhost / 127.0.0.1** several entry points **skip LIFF** and inject a test user (see SPA below).
- **No root `npm test`**: only `modules/InteriorDesigned` defines automated tests today.

---

## 1. Repo root — SPA hub (`index.html` + `spa/`)

**What it is:** Single-page hub that iframes modules under `modules/` and `tools/`. LIFF ID and GAS Web App URLs live in `shared/js/config.js` (`CONFIG`).

**Start locally:**

```bash
cd /workspace && npx --yes serve@14 -l 3000 .
```

Open `http://127.0.0.1:3000/` or `http://127.0.0.1:3000/index.html`.

**Login / identity (no real LINE on localhost):** `spa/app.js` treats `localhost` and `127.0.0.1` as local test: it sets a **fixed fake `userProfile`** and does **not** call `liff.login()`. On a real host, LIFF initializes with `CONFIG.HUB_LIFF_ID` and redirects to login if needed.

**“Feature flags”:** There is **no** central flag system. Behavior toggles are **URL hash routes**, **iframe `src`**, or **edits to `CONFIG` / page constants** — check the SPEC next to the feature.

**Manual test workflow:**

1. Load hub → confirm dashboard renders (may use cached `localStorage` keys prefixed `spa_hub_`).
2. Navigate via hash routes, e.g. `#/layout-planner`, `#/budget-audit`, `#/daily-report` (see `routes` in `spa/app.js`).
3. If API data looks wrong, hard-refresh or clear site data for this origin; hub caches employees/projects/schedule in `localStorage`.

---

## 2. Standalone HTML modules (`modules/attendance/`, `modules/projects/`, `modules/info/`)

**Start:** Same static server from repo root; open the file path, e.g. `http://127.0.0.1:3000/modules/attendance/checkin.html`.

**Login:** Most attendance pages embed **LIFF** and **GAS** URLs in-page (e.g. `checkin_test.html` / `checkin.html` `CONSTANTS`). On a normal file URL or non-LINE browser, expect LIFF init warnings; use **LINE** or align with how each page documents fallback (if any).

**`checkin_test.html`:** Use for **manual** checkout of refactored check-in UI without replacing production `checkin.html`.

**`modules/projects/js/wms_app.js`:** Scheduling demo uses **in-memory mock employees/sites** — no backend required for that prototype UI.

**Manual test workflow:** Pick the SPEC (`SPEC/03_*`, `SPEC/05_*`, etc.) → open the listed HTML → exercise the happy path; watch browser console for GAS/LIFF errors.

---

## 3. InteriorDesigned — Layout planner (only automated test suite)

**Path:** `modules/InteriorDesigned/`

**Install & run all tests (Vitest + Playwright):**

```bash
cd /workspace/modules/InteriorDesigned && npm install && npm test
```

**Unit only / E2E only:**

```bash
npm run test:unit
npm run test:e2e
```

**Playwright:** First time on a machine you may need browsers: `npx playwright install chromium`.

**Local server:** `npm run serve` serves that directory on **8765** (matches `LP_playwright.config.cjs` `webServer`).

**Manual spot-check:** `http://127.0.0.1:8765/LP_LayoutPlanner.html` (Playwright uses the same port/path).

**Docs:** `SPEC/InteriorDesigned_LayoutPlanner_SPEC.md` (testing section).

---

## 4. Tools — Budget / auditor (`tools/`)

**Pages:** `BudgetWeb_Standalone.html`, `BudgetAuditor_Standalone.html`, `BudgetAuditor_Standalone_V2.html`, `SchedulePlan.html`.

**Start:** Static server from repo root; open `/tools/<file>.html`.

**Firebase / config mock:** `localStorage` key **`fb_audit_config`** — JSON merged with defaults for Firebase keys / `databaseURL` / `gasURL` (see `BudgetAuditor_Standalone*.html` and `BudgetWeb_Standalone.html`).

**LIFF:** Auditors try LIFF init; on failure they fall back to **local mode** and may use **`setTestIdentity()`** (fixed test employee object) where implemented.

**Manual test workflow:** Set `fb_audit_config` if cloud sync needed → load project number → verify list/cache/sync line in header; check console for missing `userId` when calling GAS from a bare file open.

---

## 5. Rich menu assets (`richmenu-preview/`)

**Dependency:** `sharp` for image generation — `npm install` in that folder if you touch scripts.

**Tests:** No default `npm test` in that package; follow any script in `package.json` if added later.

---

## 6. Cloud agent hygiene

- Prefer **absolute paths** in commands (`/workspace/...`).
- After dependency or test changes, re-run **`modules/InteriorDesigned` `npm test`** before claiming green.
- **CI:** `reuseExistingServer` in Playwright config is tied to `process.env.CI`; in CI, expect Playwright to start its own server.

---

## Updating this skill

When you discover a new trick (env var, URL param, cache key, test command, LIFF bypass):

1. **Add or change a bullet** in the matching **section 1–5** above — keep commands copy-pasteable.
2. If the knowledge belongs in product behavior, **mirror one line** in the relevant `SPEC/*.md` so humans and agents do not diverge.
3. Optional: append a line to **`LOG/YYYY-MM-DD_LOG.md`** (purpose, files, verify command) for traceability.

Do **not** duplicate long prose from SPECs here; this file should stay a **short runbook**.
